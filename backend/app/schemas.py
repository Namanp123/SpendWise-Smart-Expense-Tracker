import datetime as dt
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

EXPENSE_CATEGORIES = [
    "Food", "Shopping", "Travel", "Bills", "Entertainment", "Health", "Education", "Other",
]
INCOME_CATEGORIES = ["Salary", "Freelance", "Investments", "Gift", "Other"]


class TransactionIn(BaseModel):
    type: Literal["income", "expense"]
    amount: float = Field(gt=0, le=1_000_000_000)
    category: str
    description: str = Field(default="", max_length=200)
    date: dt.date

    @field_validator("description")
    @classmethod
    def _strip(cls, v: str) -> str:
        return v.strip()

    @model_validator(mode="after")
    def _category_matches_type(self):
        allowed = EXPENSE_CATEGORIES if self.type == "expense" else INCOME_CATEGORIES
        if self.category not in allowed:
            raise ValueError(f"'{self.category}' is not a valid {self.type} category")
        return self


class TransactionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    type: str
    amount: float
    category: str
    description: str
    date: dt.date


class BudgetIn(BaseModel):
    category: str
    monthly_limit: float = Field(gt=0, le=1_000_000_000)

    @field_validator("category")
    @classmethod
    def _valid_category(cls, v: str) -> str:
        if v not in EXPENSE_CATEGORIES:
            raise ValueError(f"Budgets can only be set for expense categories, not '{v}'")
        return v
