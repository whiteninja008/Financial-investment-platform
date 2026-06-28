from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
from datetime import datetime
from typing import List, Dict

analyzer = SentimentIntensityAnalyzer()


def fetch_news(ticker: str, limit: int = 15) -> List[Dict]:
    articles = []
    try:
        import yfinance as yf
        t = yf.Ticker(ticker)
        news = t.news or []
        for item in news[:limit]:
            # yfinance returns news items as dicts with nested 'content' in newer versions
            # Handle both old and new yfinance news formats
            if isinstance(item, dict):
                # New format: item has a 'content' key with nested data
                content = item.get("content", item)
                headline = content.get("title") or item.get("title", "")
                source   = (content.get("provider", {}) or {}).get("displayName", "") or item.get("publisher", "")
                url      = (content.get("canonicalUrl", {}) or {}).get("url", "") or item.get("link", "")

                # Date: try multiple fields
                pub_time = (
                    content.get("pubDate")
                    or content.get("displayTime")
                    or item.get("providerPublishTime")
                )
                if isinstance(pub_time, str):
                    try:
                        date = datetime.fromisoformat(pub_time.replace("Z", "+00:00"))
                    except Exception:
                        date = datetime.utcnow()
                elif isinstance(pub_time, (int, float)) and pub_time > 0:
                    date = datetime.fromtimestamp(pub_time)
                else:
                    date = datetime.utcnow()
            else:
                continue

            if not headline:
                continue

            score = analyzer.polarity_scores(headline)["compound"]
            articles.append({
                "ticker":           ticker.upper(),
                "headline":         headline,
                "source":           source,
                "url":              url,
                "date":             date.strftime("%Y-%m-%d %H:%M"),
                "sentiment_score":  round(score, 4),
                "tags":             _tag(score),
            })
    except Exception as e:
        print(f"News fetch error: {e}")

    return sorted(articles, key=lambda x: x["date"], reverse=True)


def _tag(score: float) -> str:
    if score >= 0.05:
        return "positive"
    if score <= -0.05:
        return "negative"
    return "neutral"
