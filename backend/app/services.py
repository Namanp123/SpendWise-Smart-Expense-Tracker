"""Business logic: analytics, budget status, smart insights and demo data."""
import calendar
import datetime as dt
import os
import random
import statistics
from collections import defaultdict
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import Budget, Transaction

CURRENCY = os.getenv("CURRENCY", "INR").upper()
SYMBOLS = {"INR": "₹", "USD": "$", "EUR": "€", "GBP": "£"}
LOCALES = {"INR": "en-IN", "USD": "en-US", "EUR": "de-DE", "GBP": "en-GB"}


def money(x: float) -> str:
    """Format an amount for insight text (e.g. ₹1,25,000 for INR)."""
    n = int(round(abs(x)))
    s = str(n)
    if CURRENCY == "INR" and len(s) > 3:
        head, tail = s[:-3], s[-3:]
        parts = []
        while len(head) > 2:
            parts.insert(0, head[-2:])
            head = head[:-2]
        if head:
            parts.insert(0, head)
        s = ",".join(parts + [tail])
    else:
        s = f"{n:,}"
    return f"{SYMBOLS.get(CURRENCY, CURRENCY + ' ')}{s}"


# ---------- date helpers ----------

def add_months(d: dt.date, n: int) -> dt.date:
    idx = d.year * 12 + (d.month - 1) + n
    return dt.date(idx // 12, idx % 12 + 1, 1)


def parse_month(month: str | None) -> dt.date:
    if not month:
        t = dt.date.today()
        return dt.date(t.year, t.month, 1)
    y, m = month.split("-")
    return dt.date(int(y), int(m), 1)


def _range(db: Session, start: dt.date, end: dt.date) -> list[Transaction]:
    stmt = (
        select(Transaction)
        .where(Transaction.date >= start, Transaction.date < end)
        .order_by(Transaction.date.desc(), Transaction.id.desc())
    )
    return list(db.scalars(stmt))


def _f(x) -> float:
    return float(x) if isinstance(x, Decimal) else x


# ---------- analytics ----------

def analytics(db: Session, start: dt.date) -> dict:
    end = add_months(start, 1)
    txs = _range(db, start, end)

    income = sum(_f(t.amount) for t in txs if t.type == "income")
    expense = sum(_f(t.amount) for t in txs if t.type == "expense")

    by_cat: dict[str, float] = defaultdict(float)
    for t in txs:
        if t.type == "expense":
            by_cat[t.category] += _f(t.amount)
    categories = [
        {"category": c, "amount": round(a, 2), "share": round(a / expense, 4) if expense else 0}
        for c, a in sorted(by_cat.items(), key=lambda kv: -kv[1])
    ]

    days = calendar.monthrange(start.year, start.month)[1]
    daily = {start.replace(day=d): {"expense": 0.0, "income": 0.0} for d in range(1, days + 1)}
    for t in txs:
        daily[t.date][t.type] += _f(t.amount)
    daily_list = [
        {"date": d.isoformat(), "expense": round(v["expense"], 2), "income": round(v["income"], 2)}
        for d, v in daily.items()
    ]

    trend_start = add_months(start, -5)
    buckets = {add_months(trend_start, i): {"income": 0.0, "expense": 0.0} for i in range(6)}
    for t in _range(db, trend_start, end):
        buckets[t.date.replace(day=1)][t.type] += _f(t.amount)
    trend = [
        {"month": m.strftime("%Y-%m"), "label": m.strftime("%b"),
         "income": round(v["income"], 2), "expense": round(v["expense"], 2)}
        for m, v in buckets.items()
    ]

    return {
        "month": start.strftime("%Y-%m"),
        "income": round(income, 2),
        "expense": round(expense, 2),
        "balance": round(income - expense, 2),
        "savings_rate": round((income - expense) / income, 4) if income else None,
        "transaction_count": len(txs),
        "by_category": categories,
        "daily": daily_list,
        "trend": trend,
    }


# ---------- budgets ----------

def budget_status(db: Session, start: dt.date) -> list[dict]:
    end = add_months(start, 1)
    spent: dict[str, float] = defaultdict(float)
    for t in _range(db, start, end):
        if t.type == "expense":
            spent[t.category] += _f(t.amount)

    rows = []
    for b in db.scalars(select(Budget).order_by(Budget.category)):
        limit = _f(b.monthly_limit)
        s = spent.get(b.category, 0.0)
        pct = s / limit if limit else 0
        rows.append({
            "id": b.id,
            "category": b.category,
            "monthly_limit": round(limit, 2),
            "spent": round(s, 2),
            "remaining": round(limit - s, 2),
            "percent": round(pct, 4),
            "status": "over" if pct > 1 else "near" if pct >= 0.8 else "ok",
        })
    return rows


# ---------- smart insights ----------

def insights(db: Session, start: dt.date) -> list[dict]:
    end = add_months(start, 1)
    today = dt.date.today()
    is_current = start == dt.date(today.year, today.month, 1)
    txs = _range(db, start, end)
    out: list[dict] = []

    if not txs:
        return [{"level": "info", "title": "Nothing recorded this month",
                 "detail": "Add a transaction and insights will appear here."}]

    income = sum(_f(t.amount) for t in txs if t.type == "income")
    expense = sum(_f(t.amount) for t in txs if t.type == "expense")

    # Savings rate
    if income > 0:
        rate = (income - expense) / income
        if rate < 0:
            out.append({"level": "warning", "title": "Spending is above income",
                        "detail": f"You've spent {money(expense - income)} more than you earned this month."})
        elif rate >= 0.2:
            out.append({"level": "good", "title": f"Saving {round(rate * 100)}% of income",
                        "detail": f"{money(income - expense)} is left after expenses. A 20% savings rate is a solid target."})
        else:
            out.append({"level": "info", "title": f"Saving {round(rate * 100)}% of income",
                        "detail": f"{money(income - expense)} is left after expenses. Aim for 20% if you can."})
    elif expense > 0:
        out.append({"level": "info", "title": "No income recorded yet",
                    "detail": "Add this month's income to see your savings rate."})

    # Biggest category
    cats: dict[str, float] = defaultdict(float)
    for t in txs:
        if t.type == "expense":
            cats[t.category] += _f(t.amount)
    if cats and expense > 0:
        name, amt = max(cats.items(), key=lambda kv: kv[1])
        share = amt / expense
        if share >= 0.35 and len(cats) > 1:
            out.append({"level": "info", "title": f"{name} takes {round(share * 100)}% of spending",
                        "detail": f"{money(amt)} of {money(expense)} went to {name.lower()}."})

    # Compare with the previous month (same number of days when the month is still running)
    prev_start = add_months(start, -1)
    cutoff = today.day if is_current else 31
    prev_expense = sum(
        _f(t.amount) for t in _range(db, prev_start, start)
        if t.type == "expense" and t.date.day <= cutoff
    )
    if prev_expense > 0 and expense > 0:
        change = (expense - prev_expense) / prev_expense
        when = "by the same point last month" if is_current else "last month"
        if change >= 0.15:
            out.append({"level": "warning", "title": f"Spending up {round(change * 100)}% vs last month",
                        "detail": f"{money(expense)} so far, compared with {money(prev_expense)} {when}."})
        elif change <= -0.10:
            out.append({"level": "good", "title": f"Spending down {round(-change * 100)}% vs last month",
                        "detail": f"{money(expense)} so far, compared with {money(prev_expense)} {when}."})

    # Budgets
    for b in budget_status(db, start):
        if b["status"] == "over":
            out.append({"level": "warning", "title": f"{b['category']} budget exceeded",
                        "detail": f"{money(b['spent'])} spent against a {money(b['monthly_limit'])} limit ({money(-b['remaining'])} over)."})
        elif b["status"] == "near":
            out.append({"level": "warning", "title": f"{b['category']} budget at {round(b['percent'] * 100)}%",
                        "detail": f"Only {money(b['remaining'])} left of {money(b['monthly_limit'])}."})

    # Unusual expenses: far above the typical amount for their category
    history: dict[str, list[tuple[int, float]]] = defaultdict(list)
    for t in _range(db, add_months(start, -3), end):
        if t.type == "expense":
            history[t.category].append((t.id, _f(t.amount)))
    # Payments that repeat under the same description (rent, subscriptions) are expected, not unusual.
    seen: dict[tuple[str, str], int] = defaultdict(int)
    for t in _range(db, add_months(start, -3), end):
        if t.type == "expense" and t.description:
            seen[(t.category, t.description.lower())] += 1
    unusual = []
    for t in txs:
        if t.type != "expense" or seen[(t.category, t.description.lower())] >= 2:
            continue
        others = [a for i, a in history[t.category] if i != t.id]
        if len(others) >= 4:
            med = statistics.median(others)
            if med > 0 and _f(t.amount) > 2.5 * med:
                unusual.append((_f(t.amount) / med, t, med))
    for ratio, t, med in sorted(unusual, key=lambda x: -x[0])[:2]:
        label = t.description or t.category
        out.append({"level": "warning", "title": f"Unusual {t.category.lower()} expense",
                    "detail": f"{label} on {t.date.strftime('%d %b')} cost {money(_f(t.amount))}, about {ratio:.1f}x your typical {money(med)}."})

    # Projection for the running month
    if is_current and expense > 0 and today.day >= 5:
        days = calendar.monthrange(start.year, start.month)[1]
        projected = expense / today.day * days
        if income > 0 and projected > income:
            out.append({"level": "warning", "title": "On track to overspend",
                        "detail": f"At this pace you'll spend about {money(projected)} by month end, above your {money(income)} income."})
        else:
            out.append({"level": "info", "title": f"About {money(expense / today.day)} per day",
                        "detail": f"That projects to roughly {money(projected)} by the end of the month."})

    return out


# ---------- demo data ----------

def seed_demo(db: Session) -> int:
    rng = random.Random(42)
    today = dt.date.today()
    this_month = dt.date(today.year, today.month, 1)
    rows: list[Transaction] = []

    def add(kind, amount, cat, desc, day):
        if day <= (today if m == this_month else day):
            rows.append(Transaction(type=kind, amount=Decimal(str(round(amount, 2))),
                                    category=cat, description=desc, date=day))

    for offset in (-2, -1, 0):
        m = add_months(this_month, offset)
        last = calendar.monthrange(m.year, m.month)[1]
        limit = today.day if m == this_month else last
        d = lambda n: m.replace(day=min(max(n, 1), last))
        ok = lambda n: n <= limit

        if ok(1): add("income", 85000, "Salary", "Monthly salary", d(1))
        if ok(15) and rng.random() < 0.7: add("income", rng.randint(8, 20) * 1000, "Freelance", "Freelance project", d(15))
        if ok(3): add("expense", 22000, "Bills", "Rent", d(3))
        if ok(6): add("expense", rng.randint(18, 32) * 100, "Bills", "Electricity", d(6))
        if ok(8): add("expense", 1100, "Bills", "Internet", d(8))
        for _ in range(8):
            n = rng.randint(1, last)
            if ok(n): add("expense", rng.randint(30, 140) * 10, "Food", rng.choice(["Groceries", "Vegetables", "Lunch", "Dinner out"]), d(n))
        for _ in range(5):
            n = rng.randint(1, last)
            if ok(n): add("expense", rng.randint(10, 60) * 10, "Travel", rng.choice(["Cab", "Metro", "Fuel", "Bus pass"]), d(n))
        for _ in range(3):
            n = rng.randint(1, last)
            if ok(n): add("expense", rng.randint(20, 90) * 10, "Entertainment", rng.choice(["Movie", "Streaming", "Concert"]), d(n))
        for _ in range(2):
            n = rng.randint(1, last)
            if ok(n): add("expense", rng.randint(10, 35) * 100, "Shopping", rng.choice(["Clothes", "Headphones", "Home items"]), d(n))

    # One clearly unusual purchase this month so the insight shows up.
    if today.day >= 10:
        add("expense", 18500, "Shopping", "New phone", this_month.replace(day=min(today.day, 12)))

    db.add_all(rows)
    for cat, limit in {"Food": 9000, "Shopping": 6000, "Travel": 4000, "Entertainment": 3000, "Bills": 30000}.items():
        db.add(Budget(category=cat, monthly_limit=Decimal(limit)))
    db.commit()
    return len(rows)
