import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api";
import { currentMonth, makeMoney, monthLabel, shiftMonth } from "./format";
import Overview from "./components/Overview";
import Transactions from "./components/Transactions";
import Budgets from "./components/Budgets";
import TransactionForm from "./components/TransactionForm";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "transactions", label: "Transactions" },
  { id: "budgets", label: "Budgets" },
];

export default function App() {
  const [config, setConfig] = useState({ currency: "INR", locale: "en-IN" });
  const [categories, setCategories] = useState({ expense: [], income: [] });
  const [month, setMonth] = useState(currentMonth());
  const [tab, setTab] = useState("overview");
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null = closed, {} = new, tx = edit
  const [toast, setToast] = useState(null);
  const requestId = useRef(0);

  const money = makeMoney(config);
  const notify = (text, kind = "ok") => {
    setToast({ text, kind });
    setTimeout(() => setToast(null), 3500);
  };

  const load = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    try {
      const [cfg, cats, analytics, insights, budgets, transactions] = await Promise.all([
        api.config(), api.categories(), api.analytics(month), api.insights(month),
        api.budgets(month), api.transactions(month),
      ]);
      if (id !== requestId.current) return; // a newer request replaced this one
      setConfig(cfg);
      setCategories(cats);
      setData({ analytics, insights, budgets, transactions });
      setError(null);
    } catch (e) {
      if (id === requestId.current) setError(e.message);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [month]);

  useEffect(() => { load(); }, [load]);

  const act = async (fn, success) => {
    try {
      await fn();
      if (success) notify(success);
      await load();
      return true;
    } catch (e) {
      notify(e.message, "error");
      return false;
    }
  };

  const saveTransaction = (tx, id) =>
    act(() => (id ? api.updateTransaction(id, tx) : api.createTransaction(tx)), id ? "Transaction updated" : "Transaction added");
  const deleteTransaction = (tx) => {
    if (window.confirm(`Delete "${tx.description || tx.category}" (${money(tx.amount)})?`))
      act(() => api.deleteTransaction(tx.id), "Transaction deleted");
  };
  const saveBudget = (b) => act(() => api.saveBudget(b), "Budget saved");
  const deleteBudget = (b) => act(() => api.deleteBudget(b.id), "Budget removed");
  const seedDemo = () => act(() => api.seedDemo(), "Sample data loaded");

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">SpendWise</div>
        <nav className="tabs" aria-label="Sections">
          {TABS.map((t) => (
            <button key={t.id} className={tab === t.id ? "tab active" : "tab"} onClick={() => setTab(t.id)}
              aria-current={tab === t.id ? "page" : undefined}>{t.label}</button>
          ))}
        </nav>
        <div className="month-switch">
          <button className="icon-btn" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Previous month">‹</button>
          <span className="month-label">{monthLabel(month)}</span>
          <button className="icon-btn" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Next month">›</button>
        </div>
        <button className="btn primary" onClick={() => setEditing({})}>Add transaction</button>
      </header>

      <main>
        {error && (
          <div className="banner error" role="alert">
            <strong>Couldn't load your data.</strong> {error}
            <button className="btn small" onClick={load}>Try again</button>
          </div>
        )}

        {!data && loading && <p className="muted pad">Loading…</p>}

        {data && (
          <div className={loading ? "fade" : undefined}>
            {tab === "overview" && (
              <Overview data={data} money={money} onEdit={setEditing} onSeed={seedDemo}
                onAdd={() => setEditing({})} onSeeAll={() => setTab("transactions")} />
            )}
            {tab === "transactions" && (
              <Transactions transactions={data.transactions} categories={categories} money={money}
                onEdit={setEditing} onDelete={deleteTransaction} onAdd={() => setEditing({})} />
            )}
            {tab === "budgets" && (
              <Budgets budgets={data.budgets} categories={categories.expense} money={money}
                onSave={saveBudget} onDelete={deleteBudget} />
            )}
          </div>
        )}
      </main>

      {editing && (
        <TransactionForm initial={editing} categories={categories} defaultMonth={month}
          onClose={() => setEditing(null)}
          onSubmit={async (tx) => {
            const ok = await saveTransaction(tx, editing.id);
            if (ok) setEditing(null);
          }} />
      )}

      {toast && <div className={`toast ${toast.kind}`} role="status">{toast.text}</div>}
    </div>
  );
}
