import { useEffect, useRef, useState } from "react";
import { currentMonth, todayISO } from "../format";

export default function TransactionForm({ initial, categories, defaultMonth, onClose, onSubmit }) {
  const editing = Boolean(initial.id);
  const defaultDate = defaultMonth === currentMonth() ? todayISO() : `${defaultMonth}-01`;
  const [form, setForm] = useState({
    type: initial.type ?? "expense",
    amount: initial.amount ?? "",
    category: initial.category ?? "",
    description: initial.description ?? "",
    date: initial.date ?? defaultDate,
  });
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState("");
  const amountRef = useRef(null);

  const options = categories[form.type] ?? [];
  const category = options.includes(form.category) ? form.category : options[0] ?? "";

  useEffect(() => {
    amountRef.current?.focus();
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e) {
    e.preventDefault();
    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) return setProblem("Enter an amount greater than zero.");
    if (!form.date) return setProblem("Pick a date.");
    setProblem("");
    setSaving(true);
    await onSubmit({ ...form, amount, category });
    setSaving(false);
  }

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="dialog" role="dialog" aria-modal="true" aria-labelledby="dlg-title" onSubmit={submit}>
        <h2 id="dlg-title">{editing ? "Edit transaction" : "Add transaction"}</h2>

        <div className="segmented" role="group" aria-label="Transaction type">
          {["expense", "income"].map((t) => (
            <button type="button" key={t} className={form.type === t ? `seg active ${t}` : "seg"}
              onClick={() => set("type", t)} aria-pressed={form.type === t}>
              {t === "expense" ? "Expense" : "Income"}
            </button>
          ))}
        </div>

        <label>Amount
          <input ref={amountRef} type="number" inputMode="decimal" min="0" step="0.01" value={form.amount}
            onChange={(e) => set("amount", e.target.value)} placeholder="0.00" />
        </label>
        <div className="row2">
          <label>Category
            <select value={category} onChange={(e) => set("category", e.target.value)}>
              {options.map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
          <label>Date
            <input type="date" value={form.date} onChange={(e) => set("date", e.target.value)} />
          </label>
        </div>
        <label>Note <span className="muted">(optional)</span>
          <input type="text" maxLength={200} value={form.description}
            onChange={(e) => set("description", e.target.value)} placeholder="e.g. Groceries" />
        </label>

        {problem && <p className="form-error" role="alert">{problem}</p>}

        <div className="dialog-actions">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn primary" disabled={saving}>
            {saving ? "Saving…" : editing ? "Save changes" : "Add transaction"}
          </button>
        </div>
      </form>
    </div>
  );
}
