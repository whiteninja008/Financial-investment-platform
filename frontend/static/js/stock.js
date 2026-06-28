// ─── State ────────────────────────────────────────────────────────────────────
let stockData = null;
let priceChart = null, rsiChart = null, macdChart = null;
let currentPeriod = '1mo';

// ─── Boot ─────────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => loadStock(currentPeriod));

async function loadStock(period = '1mo') {
  currentPeriod = period;

  // For period-switching, do a lightweight in-place reload (no full overlay flash)
  const isFirstLoad = !stockData;
  if (isFirstLoad) showLoading(true);
  else showMiniLoading(true);

  try {
    const res = await fetch(`/api/stock/${TICKER}?period=${period}`);
    if (!res.ok) throw new Error(await res.text());
    stockData = await res.json();
    render(stockData);
    if (isFirstLoad) loadNews();
  } catch(e) {
    showLoading(false);
    showMiniLoading(false);
    document.getElementById('stockMain').style.display = 'block';
    document.getElementById('stockMain').innerHTML =
      `<div style="padding:40px;color:var(--red)">Error loading ${TICKER}: ${e.message}</div>`;
  }
}

function showLoading(v) {
  document.getElementById('loadingOverlay').style.display = v ? 'flex' : 'none';
  document.getElementById('stockMain').style.display     = v ? 'none' : 'block';
}

function showMiniLoading(v) {
  let el = document.getElementById('miniLoader');
  if (!el) {
    el = document.createElement('div');
    el.id = 'miniLoader';
    el.style.cssText = 'position:fixed;top:60px;right:24px;z-index:300;background:var(--bg-2);border:1px solid var(--border-2);border-radius:var(--radius);padding:6px 14px;font-size:12px;color:var(--accent);font-family:var(--font-mono)';
    el.textContent = 'Updating…';
    document.body.appendChild(el);
  }
  el.style.display = v ? 'block' : 'none';
}

function switchPeriod(period, btn) {
  document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  loadStock(period);
}

function goSearch(ticker) {
  window.location.href = `/stock/${ticker.toUpperCase().trim()}`;
}

// ─── Render orchestrator ──────────────────────────────────────────────────────
function render(data) {
  renderHero(data);
  renderCharts(data);
  renderTrend(data);
  renderMetrics(data);
  renderSector(data);
  renderSupplyChain(data);
  renderWatchlistBtn(data);
  showLoading(false);
  showMiniLoading(false);
}

// Period label map for display
const PERIOD_LABELS = {
  '1d': '1 Day', '5d': '1 Week', '1mo': '1 Month',
  '3mo': '3 Months', '6mo': '6 Months', '1y': '1 Year',
  '2y': '2 Years', '5y': '5 Years',
};

// ─── Hero ─────────────────────────────────────────────────────────────────────
function renderHero(data) {
  const info = data.info;
  const hist = data.history;
  document.title = `${TICKER} — FinInt`;
  document.getElementById('stockTicker').textContent = TICKER;
  document.getElementById('stockName').textContent   = info.name || TICKER;
  document.getElementById('stockSector').textContent = `${info.sector || '—'} · ${info.industry || '—'}`;

  // Period-aware price and change
  const currentPrice = info.current_price;
  const periodLabel  = PERIOD_LABELS[currentPeriod] || currentPeriod;

  document.getElementById('stockPrice').textContent = currentPrice ? `$${currentPrice.toFixed(2)}` : '—';

  const priceEl = document.getElementById('stockChange');
  if (hist && hist.length >= 2 && currentPrice) {
    const periodOpen = hist[0].open || hist[0].close;
    const chg  = currentPrice - periodOpen;
    const pct  = (chg / periodOpen * 100).toFixed(2);
    const sign = chg >= 0 ? '+' : '';
    priceEl.textContent = `${sign}${chg.toFixed(2)} (${sign}${pct}%) · ${periodLabel}`;
    priceEl.className   = 'stock-change ' + (chg >= 0 ? 'up' : 'down');
  } else if (currentPrice && info.previous_close) {
    const chg = currentPrice - info.previous_close;
    const pct = (chg / info.previous_close * 100).toFixed(2);
    const sign = chg >= 0 ? '+' : '';
    priceEl.textContent = `${sign}${chg.toFixed(2)} (${sign}${pct}%) · 1 Day`;
    priceEl.className   = 'stock-change ' + (chg >= 0 ? 'up' : 'down');
  }

  // Period-aware verdict
  const s = data.summary;
  const colors = { Bullish: '#00ff9f', Bearish: '#ff4757', Neutral: '#ffd700' };
  document.getElementById('verdictCard').style.borderLeftColor = colors[s.verdict] || 'var(--accent)';
  document.getElementById('verdictStatus').textContent = `${s.verdict} · ${periodLabel} View`;
  document.getElementById('verdictStatus').style.color = colors[s.verdict] || 'var(--text)';
  document.getElementById('verdictBullets').innerHTML  = (s.bullets || []).map(b => `<li>${b}</li>`).join('');

  // Key stats — mix of static fundamentals + period-specific technicals
  const periodHigh = hist ? Math.max(...hist.map(h => h.high).filter(Boolean)) : null;
  const periodLow  = hist ? Math.min(...hist.map(h => h.low).filter(Boolean))  : null;
  const stats = [
    { key: 'Market Cap',         val: fmtCap(info.market_cap) },
    { key: `${periodLabel} High`, val: periodHigh ? '$'+periodHigh.toFixed(2) : '—' },
    { key: `${periodLabel} Low`,  val: periodLow  ? '$'+periodLow.toFixed(2)  : '—' },
    { key: '52W High',           val: info.fifty_two_week_high ? '$'+info.fifty_two_week_high.toFixed(2) : '—' },
    { key: '52W Low',            val: info.fifty_two_week_low  ? '$'+info.fifty_two_week_low.toFixed(2)  : '—' },
    { key: 'Beta',               val: info.beta ? info.beta.toFixed(2) : '—' },
    { key: 'Trend',              val: data.current.trend },
    { key: 'RSI (14)',           val: data.current.rsi ? data.current.rsi.toFixed(1) : '—' },
  ];
  document.getElementById('keyStats').innerHTML = stats.map(s =>
    `<div class="stat-chip"><span class="stat-key">${s.key}</span><span class="stat-val">${s.val || '—'}</span></div>`
  ).join('');
}

// ─── Charts ───────────────────────────────────────────────────────────────────
function renderCharts(data) {
  const hist = data.history;
  if (!hist || !hist.length) return;

  const labels = hist.map(h => h.date);
  const closes = hist.map(h => h.close);
  const highs   = hist.map(h => h.high);
  const lows    = hist.map(h => h.low);
  const ema20   = hist.map(h => h.ema_20);
  const ema50   = hist.map(h => h.ema_50);
  const sma200  = hist.map(h => h.sma_200);
  const support = hist.map(h => h.support_level);
  const resist  = hist.map(h => h.resistance_level);
  const gzLow   = hist.map(h => h.golden_zone_low);
  const gzHigh  = hist.map(h => h.golden_zone_high);
  const rsi     = hist.map(h => h.rsi);
  const macd    = hist.map(h => h.macd);
  const macdSig = hist.map(h => h.macd_signal);

  // ── Price chart ──────────────────────────────────────────────────────────────
  if (priceChart) priceChart.destroy();
  const ctx = document.getElementById('priceChart').getContext('2d');

  priceChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Price', data: closes, borderColor: '#00d4ff', borderWidth: 2,
          pointRadius: 0, tension: 0.1, fill: false, order: 1,
        },
        {
          label: 'EMA 20', data: ema20, borderColor: 'rgba(167,139,250,.7)',
          borderWidth: 1.5, pointRadius: 0, tension: 0, fill: false, borderDash: [],
        },
        {
          label: 'EMA 50', data: ema50, borderColor: 'rgba(255,215,0,.7)',
          borderWidth: 1.5, pointRadius: 0, tension: 0, fill: false,
        },
        {
          label: 'SMA 200', data: sma200, borderColor: 'rgba(255,71,87,.5)',
          borderWidth: 1, pointRadius: 0, tension: 0, fill: false, borderDash: [4,4],
        },
        {
          label: 'Support', data: support, borderColor: '#00ff9f',
          borderWidth: 1, pointRadius: 0, borderDash: [6,3], fill: false,
        },
        {
          label: 'Resistance', data: resist, borderColor: '#ff4757',
          borderWidth: 1, pointRadius: 0, borderDash: [6,3], fill: false,
        },
        {
          label: 'Golden Zone High', data: gzHigh, borderColor: 'transparent',
          backgroundColor: 'rgba(255,215,0,.1)', fill: '+1', pointRadius: 0,
        },
        {
          label: 'Golden Zone Low', data: gzLow, borderColor: 'rgba(255,215,0,.2)',
          borderWidth: 1, borderDash: [2,4], fill: false, pointRadius: 0,
        },
      ]
    },
    options: chartOptions('Price ($)'),
  });

  // ── RSI chart ────────────────────────────────────────────────────────────────
  if (rsiChart) rsiChart.destroy();
  rsiChart = new Chart(document.getElementById('rsiChart').getContext('2d'), {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'RSI', data: rsi, borderColor: '#a78bfa',
        borderWidth: 1.5, pointRadius: 0, tension: 0.1, fill: false,
      }]
    },
    options: {
      ...chartOptions('RSI'),
      plugins: {
        ...chartOptions('RSI').plugins,
        annotation: {
          annotations: {
            ob: { type: 'line', yMin: 70, yMax: 70, borderColor: 'rgba(255,71,87,.4)', borderDash: [4,4] },
            os: { type: 'line', yMin: 30, yMax: 30, borderColor: 'rgba(0,255,159,.4)', borderDash: [4,4] },
          }
        }
      },
      scales: { ...chartOptions('RSI').scales, y: { ...chartOptions('RSI').scales.y, min: 0, max: 100 } }
    }
  });

  // ── MACD chart ───────────────────────────────────────────────────────────────
  if (macdChart) macdChart.destroy();
  macdChart = new Chart(document.getElementById('macdChart').getContext('2d'), {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'MACD',   data: macd,    borderColor: '#00d4ff', borderWidth: 1.5, pointRadius: 0, fill: false },
        { label: 'Signal', data: macdSig, borderColor: '#ff6b35', borderWidth: 1.5, pointRadius: 0, borderDash: [4,4], fill: false },
      ]
    },
    options: chartOptions('MACD'),
  });
}

function chartOptions(yLabel) {
  return {
    responsive: true, maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: true, labels: { color: '#4a5568', boxWidth: 12, font: { size: 11 } } },
      tooltip: {
        backgroundColor: '#0f1114', borderColor: '#1f2530', borderWidth: 1,
        titleColor: '#8892a4', bodyColor: '#e2e8f0', padding: 10,
      },
    },
    scales: {
      x: {
        ticks: { color: '#4a5568', font: { size: 10 }, maxRotation: 0, maxTicksLimit: 8 },
        grid:  { color: '#1a1e25' },
      },
      y: {
        position: 'right',
        ticks: { color: '#4a5568', font: { size: 10 } },
        grid:  { color: '#1a1e25' },
      }
    }
  };
}

// ─── Trend analysis ───────────────────────────────────────────────────────────
const TREND_TOOLTIPS = {
  'Trend Direction': 'Detected by comparing recent swing highs and lows. Higher highs + higher lows = Uptrend. Lower highs + lower lows = Downtrend.',
  'RSI (14)':        'Relative Strength Index (0–100). Above 70 = overbought (potential pullback). Below 30 = oversold (potential bounce). 40–60 = neutral.',
  'EMA 20':          'Exponential Moving Average over 20 days. Short-term trend line. Price above EMA 20 is generally bullish short-term.',
  'EMA 50':          'Exponential Moving Average over 50 days. Medium-term trend. A "golden cross" (EMA 20 crossing above EMA 50) is a bullish signal.',
  'SMA 200':         'Simple Moving Average over 200 days. The most watched long-term trend line. Price above SMA 200 = long-term bull market.',
  'Support Zone':    'The lowest price reached over the last 20 sessions. Buyers have historically stepped in around this level.',
  'Resistance Zone': 'The highest price reached over the last 20 sessions. Sellers have historically appeared around this level.',
  'Golden Zone':     'Fibonacci retracement between 61.8% and 78.6% of the recent swing range. A common area where pullbacks reverse in an uptrend — considered high-probability buy zone.',
  'MACD':            'Moving Average Convergence Divergence. Measures momentum. When MACD crosses above the signal line it is bullish; below is bearish.',
};

function infoIcon(key) {
  const tip = TREND_TOOLTIPS[key];
  if (!tip) return '';
  return `<i class="info-icon">i<span class="tooltip">${tip}</span></i>`;
}

function renderTrend(data) {
  const cur = data.current;
  const trendColors = { Uptrend: '#00ff9f', Downtrend: '#ff4757', Sideways: '#ffd700' };
  const trendColor  = trendColors[cur.trend] || '#8892a4';

  const items = [
    { key: 'Trend Direction', val: null, badge: cur.trend },
    { key: 'RSI (14)',        val: cur.rsi     ? cur.rsi.toFixed(1)     : '—' },
    { key: 'EMA 20',          val: cur.ema_20  ? '$'+cur.ema_20.toFixed(2)  : '—' },
    { key: 'EMA 50',          val: cur.ema_50  ? '$'+cur.ema_50.toFixed(2)  : '—' },
    { key: 'SMA 200',         val: cur.sma_200 ? '$'+cur.sma_200.toFixed(2) : '—' },
    { key: 'Support Zone',    val: cur.support    ? '$'+cur.support.toFixed(2)    : '—' },
    { key: 'Resistance Zone', val: cur.resistance ? '$'+cur.resistance.toFixed(2) : '—' },
    { key: 'Golden Zone',     val: (cur.golden_low && cur.golden_high)
        ? `$${cur.golden_low.toFixed(2)} – $${cur.golden_high.toFixed(2)}` : '—' },
  ];

  document.getElementById('trendAnalysis').innerHTML = items.map(item => `
    <div class="trend-item">
      <div class="trend-key">${item.key} ${infoIcon(item.key)}</div>
      ${item.badge
        ? `<span class="trend-label-badge" style="background:${trendColor}20;color:${trendColor}">${item.badge}</span>`
        : `<div class="trend-val">${item.val}</div>`
      }
    </div>
  `).join('');
}

// ─── Financial metrics ────────────────────────────────────────────────────────
const METRICS_DEF = [
  {
    key: 'pe_ratio', name: 'P/E Ratio',
    fmt: v => v.toFixed(1) + 'x',
    desc: 'Price-to-Earnings. How much investors pay per $1 of earnings. High = growth expectations, low = value or concern.',
    sentiment: v => v < 15 ? '🟢 Potentially undervalued' : v > 40 ? '🔴 High valuation' : '🟡 Fairly valued',
  },
  {
    key: 'forward_pe', name: 'Forward P/E',
    fmt: v => v.toFixed(1) + 'x',
    desc: 'P/E based on next 12 months earnings estimates. Compares current to expected future earnings.',
    sentiment: v => v < 15 ? '🟢 Cheap on forward basis' : v > 35 ? '🔴 Expensive forward' : '🟡 Moderate',
  },
  {
    key: 'eps', name: 'EPS (TTM)',
    fmt: v => '$' + v.toFixed(2),
    desc: 'Earnings Per Share. Company profit divided by outstanding shares. Positive = profitable.',
    sentiment: v => v > 0 ? '🟢 Profitable' : '🔴 Losing money',
  },
  {
    key: 'beta', name: 'Beta',
    fmt: v => v.toFixed(2),
    desc: 'Volatility vs S&P 500. Beta > 1 = moves more than the market. Beta < 1 = more stable.',
    sentiment: v => v > 1.5 ? '🔴 High volatility' : v < 0.7 ? '🟢 Low volatility / defensive' : '🟡 Market-like',
  },
  {
    key: 'dividend_yield', name: 'Dividend Yield',
    fmt: v => (v * 100).toFixed(2) + '%',
    desc: 'Annual dividend as % of stock price. Income return if you hold the stock.',
    sentiment: v => v > 0.04 ? '🟢 High yield' : v > 0 ? '🟡 Modest yield' : '⚪ No dividend',
  },
  {
    key: 'price_to_book', name: 'P/B Ratio',
    fmt: v => v.toFixed(2) + 'x',
    desc: 'Price vs book value (assets minus liabilities). P/B < 1 can signal undervaluation.',
    sentiment: v => v < 1 ? '🟢 Below book value' : v > 5 ? '🔴 Expensive vs assets' : '🟡 Normal range',
  },
  {
    key: 'return_on_equity', name: 'ROE',
    fmt: v => (v * 100).toFixed(1) + '%',
    desc: 'Return on Equity. How efficiently management generates profit from shareholders\' equity.',
    sentiment: v => v > 0.2 ? '🟢 Strong returns' : v > 0.1 ? '🟡 Decent' : '🔴 Weak returns',
  },
  {
    key: 'debt_to_equity', name: 'Debt/Equity',
    fmt: v => v.toFixed(2),
    desc: 'Financial leverage ratio. High D/E = more debt risk, but can amplify returns.',
    sentiment: v => v > 2 ? '🔴 High leverage' : v > 1 ? '🟡 Moderate debt' : '🟢 Conservative balance sheet',
  },
  {
    key: 'gross_margins', name: 'Gross Margin',
    fmt: v => (v * 100).toFixed(1) + '%',
    desc: 'Revenue minus cost of goods sold. High margins = pricing power and efficiency.',
    sentiment: v => v > 0.5 ? '🟢 Strong margins' : v > 0.2 ? '🟡 Average' : '🔴 Thin margins',
  },
  {
    key: 'free_cashflow', name: 'Free Cash Flow',
    fmt: v => fmtCap(v),
    desc: 'Cash left after capital expenditures. The purest measure of a company\'s financial health.',
    sentiment: v => v > 0 ? '🟢 Cash generative' : '🔴 Cash burn',
  },
];

function renderMetrics(data) {
  const info = data.info;
  document.getElementById('financialMetrics').innerHTML = METRICS_DEF.map(m => {
    const val = info[m.key];
    if (val == null) return '';
    return `<div class="metric-card">
      <div class="metric-name" style="display:flex;align-items:center;gap:6px">
        ${m.name}
        <i class="info-icon">i<span class="tooltip">${m.desc}</span></i>
      </div>
      <div class="metric-val">${m.fmt(val)}</div>
      <div class="metric-sentiment">${m.sentiment(val)}</div>
    </div>`;
  }).join('');
}

// ─── Sector ───────────────────────────────────────────────────────────────────
function renderSector(data) {
  const perf  = data.sector_perf;
  const sector = data.info.sector || 'Unknown';
  const color  = perf > 0 ? '#00ff9f' : perf < 0 ? '#ff4757' : '#8892a4';
  document.getElementById('sectorScore').innerHTML = `
    <div class="sector-block">
      <div>
        <div style="font-size:11px;color:var(--text-3);margin-bottom:4px">SECTOR (1M PERF)</div>
        <div class="sector-name">${sector}</div>
      </div>
      <div class="sector-perf" style="color:${color}">
        ${perf != null ? (perf > 0 ? '+' : '') + perf.toFixed(2) + '%' : '—'}
      </div>
    </div>`;
}

// ─── Supply chain ─────────────────────────────────────────────────────────────
function renderSupplyChain(data) {
  const sc = data.supply_chain;
  const renderGroup = (label, tickers) => {
    const chips = tickers.length
      ? tickers.map(t => `<a class="supply-ticker" href="/stock/${t}">${t}</a>`).join('')
      : `<span class="supply-empty">None mapped</span>`;
    return `<div class="supply-group">
      <div class="supply-group-label">${label}</div>
      <div class="supply-tickers">${chips}</div>
    </div>`;
  };
  document.getElementById('supplyChain').innerHTML =
    renderGroup('Suppliers', sc.suppliers || []) +
    renderGroup('Customers', sc.customers || []) +
    renderGroup('Peers', sc.peers || []);
}

// ─── News ─────────────────────────────────────────────────────────────────────
async function loadNews() {
  try {
    const news = await fetch(`/api/stock/${TICKER}/news`).then(r => r.json());
    const sentColors = { positive: '#00ff9f', negative: '#ff4757', neutral: '#ffd700' };
    const sentLabels = { positive: '▲ Positive', negative: '▼ Negative', neutral: '● Neutral' };
    document.getElementById('newsFeed').innerHTML = news.length
      ? news.map(n => `
        <div class="news-item">
          <div class="news-sentiment-dot" style="background:${sentColors[n.tags] || '#8892a4'}"></div>
          <div class="news-body">
            <a class="news-headline" href="${n.url}" target="_blank" rel="noopener">${n.headline}</a>
            <div class="news-meta">
              <span>${n.source || 'Unknown'}</span>
              <span>${n.date || ''}</span>
              <span class="news-score" style="color:${sentColors[n.tags] || '#8892a4'}">
                ${sentLabels[n.tags] || '●'} ${n.sentiment_score >= 0 ? '+' : ''}${n.sentiment_score?.toFixed(2)}
              </span>
            </div>
          </div>
        </div>`).join('')
      : '<div style="color:var(--text-3);padding:8px">No news available.</div>';
  } catch(e) {
    console.error('News load error:', e);
    document.getElementById('newsFeed').innerHTML = '<div style="color:var(--text-3);padding:8px">Could not load news.</div>';
  }
}

// ─── Watchlist toggle ─────────────────────────────────────────────────────────
async function toggleWatchlist() {
  const btn = document.getElementById('wlToggleBtn');
  const inList = btn.textContent.includes('Remove');
  if (inList) {
    await fetch(`/api/watchlist/${TICKER}`, { method: 'DELETE' });
    btn.textContent = '+ Watchlist';
    btn.style.borderColor = '';
    btn.style.color = '';
  } else {
    await fetch(`/api/watchlist/${TICKER}`, { method: 'POST' });
    btn.textContent = '✓ Remove from Watchlist';
    btn.style.borderColor = 'var(--green)';
    btn.style.color = 'var(--green)';
  }
}

async function renderWatchlistBtn(data) {
  try {
    const list = await fetch('/api/watchlist').then(r => r.json());
    const inList = list.some(i => i.ticker === TICKER);
    const btn = document.getElementById('wlToggleBtn');
    if (inList) {
      btn.textContent = '✓ Remove from Watchlist';
      btn.style.borderColor = 'var(--green)';
      btn.style.color = 'var(--green)';
    }
  } catch(e) {}
}

// ─── Utilities ────────────────────────────────────────────────────────────────
function fmtCap(n) {
  if (n == null) return '—';
  if (n >= 1e12) return '$' + (n/1e12).toFixed(2) + 'T';
  if (n >= 1e9)  return '$' + (n/1e9).toFixed(2) + 'B';
  if (n >= 1e6)  return '$' + (n/1e6).toFixed(2) + 'M';
  if (n >= 1000) return n.toLocaleString();
  return n.toFixed(0);
}
