from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.requests import Request
from fastapi.responses import HTMLResponse
import sys, os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from backend.models.database import init_db
from backend.routers.api import router

app = FastAPI(title="Financial Intelligence Platform")

# Init DB on startup
init_db()

# Static files + templates
app.mount("/static", StaticFiles(directory="frontend/static"), name="static")
templates = Jinja2Templates(directory="frontend/templates")

# Include API routes
app.include_router(router)


@app.get("/", response_class=HTMLResponse)
def root(request: Request):
    return templates.TemplateResponse(request, "index.html")


@app.get("/stock/{ticker}", response_class=HTMLResponse)
def stock_page(request: Request, ticker: str):
    return templates.TemplateResponse(request, "stock.html", {"ticker": ticker.upper()})


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
