import { useState } from "react";
import { percent } from "../format";

export default function Budgets({ budgets, categories, money, onSave, onDelete }) {
  const [category, setCategory] = useState("");
  const [limit, setLimit] = useState("");
  const selected = category || categories[0] || "";

  const submit = async (e) => {
    e.preventDefault();
    const value = Number(limit);
    if (!(value > 0)) return;
    await onSave({ category: selected, monthly_limit: value });
    setLimit("");
  };

  const edit = (b) => { setCategory(b.category); setLimit(String(b.monthly_limit)); };

  return (
    <section className="budgets">
      <form className="budget-form" onSubmit={submit}>
        <h2>Set a monthly budget</h2>
        <p className="muted">Pick a category and a limit. Saving again for the same category updates it.</p>
        <label>Category
          <select value={selected} onChange={(e) => setCategory(e.target.value)}>
            {categories.map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
        <label>Monthly limit
          <input type="number" min="0" step="1" value={limit} onChange={(e) => setLimit(e.target.value)} placeholder="0" />
        </label>
        <button className="btn primary" type="submit" disabled={!(Number(limit) > 0)}>Save budget</button>
      </form>

      <div className="budget-list">
        {budgets.length === 0 ? (
          <div className="empty">
            <h3>No budgets yet</h3>
            <p className="muted">Set a limit for a category and SpendWise will track it against this month's spending.</p>
          </div>
        ) : (
          budgets.map((b) => (
            <article key={b.id} className="budget">
              <div className="budget-head">
                <h3>{b.category}</h3>
                <span className={`status ${b.status}`}>
                  {b.status === "over" ? "Over budget" : b.status === "near" ? "Almost there" : "On track"}
                </span>
              </div>
              <div className="meter" role="progressbar" aria-valuemin={0} aria-valuemax={100}
                aria-valuenow={Math.min(100, Math.round(b.percent * 100))} aria-label={`${b.category} budget used`}>
                <div className={`meter-fill ${b.status}`} style={{ width: `${Math.min(100, b.percent * 100)}%` }} />
              </div>
              <div className="budget-foot">
                <span><strong>{money(b.spent)}</strong> of {money(b.monthly_limit)} ({percent(b.percent)})</span>
                <span className="muted">
                  {b.remaining >= 0 ? `${money(b.remaining)} left` : `${money(-b.remaining)} over`}
                </span>
              </div>
              <div className="actions">
                <button className="link" onClick={() => edit(b)}>Change limit</button>
                <button className="link danger" onClick={() => onDelete(b)}>Remove</button>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
