import warnings
from contextlib import asynccontextmanager
from decimal import Decimal

from fastapi import Depends, FastAPI, HTTPException, Query, Response
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from . import services
from .database import Base, IS_SQLITE, engine, get_db
from .models import Budget, Transaction
from .schemas import (
    EXPENSE_CATEGORIES, INCOME_CATEGORIES, BudgetIn, TransactionIn, TransactionOut,
)

# SQLite stores Numeric as float and warns about Decimal; amounts are rounded to 2dp, so this is safe.
warnings.filterwarnings("ignore", message=".*Decimal objects natively.*")

MONTH_PATTERN = r"^\d{4}-(0[1-9]|1[0-2])$"


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(title="SpendWise API", version="0.2.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_methods=["*"],
    allow_headers=["*"],
)


def _dec(x: float) -> Decimal:
    return Decimal(str(round(x, 2)))


def month_start(month: str | None = Query(None, pattern=MONTH_PATTERN)):
    return services.parse_month(month)


# ---------- meta ----------

@app.get("/api/health")
def health(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        database = "sqlite" if IS_SQLITE else "postgres"
    except Exception as exc:  # pragma: no cover
        raise HTTPException(503, f"Database unavailable: {exc.__class__.__name__}")
    return {"status": "healthy", "database": database}


@app.get("/api/config")
def config():
    return {"currency": services.CURRENCY, "locale": services.LOCALES.get(services.CURRENCY, "en-US")}


@app.get("/api/categories")
def categories():
    return {"expense": EXPENSE_CATEGORIES, "income": INCOME_CATEGORIES}


# ---------- transactions ----------

@app.get("/api/transactions", response_model=list[TransactionOut])
def list_transactions(
    month: str | None = Query(None, pattern=MONTH_PATTERN),
    type: str | None = Query(None, pattern="^(income|expense)$"),
    category: str | None = None,
    limit: int = Query(500, ge=1, le=2000),
    db: Session = Depends(get_db),
):
    stmt = select(Transaction)
    if month:
        start = services.parse_month(month)
        stmt = stmt.where(Transaction.date >= start, Transaction.date < services.add_months(start, 1))
    if type:
        stmt = stmt.where(Transaction.type == type)
    if category:
        stmt = stmt.where(Transaction.category == category)
    stmt = stmt.order_by(Transaction.date.desc(), Transaction.id.desc()).limit(limit)
    return list(db.scalars(stmt))


@app.post("/api/transactions", response_model=TransactionOut, status_code=201)
def create_transaction(body: TransactionIn, db: Session = Depends(get_db)):
    tx = Transaction(**{**body.model_dump(), "amount": _dec(body.amount)})
    db.add(tx)
    db.commit()
    db.refresh(tx)
    return tx


@app.put("/api/transactions/{tx_id}", response_model=TransactionOut)
def update_transaction(tx_id: int, body: TransactionIn, db: Session = Depends(get_db)):
    tx = db.get(Transaction, tx_id)
    if not tx:
        raise HTTPException(404, "Transaction not found")
    for key, value in body.model_dump().items():
        setattr(tx, key, _dec(value) if key == "amount" else value)
    db.commit()
    db.refresh(tx)
    return tx


@app.delete("/api/transactions/{tx_id}", status_code=204)
def delete_transaction(tx_id: int, db: Session = Depends(get_db)):
    tx = db.get(Transaction, tx_id)
    if not tx:
        raise HTTPException(404, "Transaction not found")
    db.delete(tx)
    db.commit()
    return Response(status_code=204)


# ---------- analytics & insights ----------

@app.get("/api/analytics")
def get_analytics(start=Depends(month_start), db: Session = Depends(get_db)):
    return services.analytics(db, start)


@app.get("/api/insights")
def get_insights(start=Depends(month_start), db: Session = Depends(get_db)):
    return services.insights(db, start)


# ---------- budgets ----------

@app.get("/api/budgets")
def get_budgets(start=Depends(month_start), db: Session = Depends(get_db)):
    return services.budget_status(db, start)


@app.put("/api/budgets")
def upsert_budget(body: BudgetIn, db: Session = Depends(get_db)):
    budget = db.scalar(select(Budget).where(Budget.category == body.category))
    if budget:
        budget.monthly_limit = _dec(body.monthly_limit)
    else:
        db.add(Budget(category=body.category, monthly_limit=_dec(body.monthly_limit)))
    db.commit()
    return {"ok": True}


@app.delete("/api/budgets/{budget_id}", status_code=204)
def delete_budget(budget_id: int, db: Session = Depends(get_db)):
    budget = db.get(Budget, budget_id)
    if not budget:
        raise HTTPException(404, "Budget not found")
    db.delete(budget)
    db.commit()
    return Response(status_code=204)


# ---------- demo data ----------

@app.post("/api/seed-demo")
def seed_demo(db: Session = Depends(get_db)):
    if db.scalar(select(func.count()).select_from(Transaction)):
        raise HTTPException(409, "Sample data can only be loaded into an empty database.")
    return {"created": services.seed_demo(db)}
