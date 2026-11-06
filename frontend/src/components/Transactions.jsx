import { useMemo, useState } from "react";
import { shortDate } from "../format";

export default function Transactions({ transactions, categories, money, onEdit, onDelete, onAdd }) {
  const [q, setQ] = useState("");
  const [type, setType] = useState("all");
  const [category, setCategory] = useState("all");

  const allCategories = useMemo(
    () => [...new Set([...categories.expense, ...categories.income])].sort(),
    [categories]
  );

  const rows = transactions.filter(
    (t) =>
      (type === "all" || t.type === type) &&
      (category === "all" || t.category === category) &&
      (!q || `${t.description} ${t.category}`.toLowerCase().includes(q.toLowerCase()))
  );

  return (
    <section>
      <div className="toolbar">
        <input type="search" placeholder="Search transactions" value={q} onChange={(e) => setQ(e.target.value)}
          aria-label="Search transactions" />
        <select value={type} onChange={(e) => setType(e.target.value)} aria-label="Filter by type">
          <option value="all">All types</option>
          <option value="expense">Expenses</option>
          <option value="income">Income</option>
        </select>
        <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Filter by category">
          <option value="all">All categories</option>
          {allCategories.map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>

      {transactions.length === 0 ? (
        <div className="empty">
          <h3>No transactions this month</h3>
          <p className="muted">Record your first income or expense to get started.</p>
          <button className="btn primary" onClick={onAdd}>Add transaction</button>
        </div>
      ) : rows.length === 0 ? (
        <p className="muted pad">No transactions match these filters.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Date</th><th>Note</th><th>Category</th><th className="num">Amount</th><th><span className="sr">Actions</span></th></tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id}>
                  <td className="nowrap">{shortDate(t.date)}</td>
                  <td>{t.description || <span className="muted">No note</span>}</td>
                  <td><span className="chip">{t.category}</span></td>
                  <td className={`num ${t.type}`}>{t.type === "income" ? "+" : "−"}{money(t.amount)}</td>
                  <td className="actions">
                    <button className="link" onClick={() => onEdit(t)}>Edit</button>
                    <button className="link danger" onClick={() => onDelete(t)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="muted count">{rows.length} of {transactions.length} transactions</p>
    </section>
  );
}
