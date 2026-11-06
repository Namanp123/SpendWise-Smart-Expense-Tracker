import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { percent, shortDate } from "../format";

const PALETTE = ["#2743D6", "#0E8F77", "#D4435B", "#C98512", "#7A4FD1", "#2E8FC4", "#8A6D4B", "#6B7A90"];
const INCOME = "#0E8F77";
const EXPENSE = "#D4435B";

export default function Overview({ data, money, onEdit, onSeed, onAdd, onSeeAll }) {
  const { analytics: a, insights, transactions } = data;

  if (a.transaction_count === 0) {
    return (
      <div className="empty big">
        <h2>Nothing recorded for this month</h2>
        <p className="muted">Add an income or expense to see your balance, charts and insights. New here? Load sample data to look around.</p>
        <div className="empty-actions">
          <button className="btn primary" onClick={onAdd}>Add transaction</button>
          <button className="btn" onClick={onSeed}>Load sample data</button>
        </div>
      </div>
    );
  }

  const spentShare = a.income > 0 ? Math.min(1, a.expense / a.income) : 1;
  const money0 = (v) => money(v);

  return (
    <div className="overview">
      <section className="hero" aria-label="Month summary">
        <div className="hero-main">
          <p className="hero-label">Left this month</p>
          <p className={a.balance < 0 ? "hero-number neg" : "hero-number"}>{money(a.balance)}</p>
        </div>
        <div className="split">
          <div className="split-bar" aria-hidden="true">
            <div className="split-spent" style={{ width: `${spentShare * 100}%` }} />
          </div>
          <div className="split-legend">
            <span><i className="dot" style={{ background: EXPENSE }} />Spent {money(a.expense)}</span>
            <span><i className="dot" style={{ background: INCOME }} />Earned {money(a.income)}</span>
          </div>
        </div>
        <dl className="stats">
          <div><dt>Income</dt><dd className="income">{money(a.income)}</dd></div>
          <div><dt>Expenses</dt><dd className="expense">{money(a.expense)}</dd></div>
          <div><dt>Savings rate</dt><dd>{a.savings_rate === null ? "—" : percent(a.savings_rate)}</dd></div>
        </dl>
      </section>

      <section className="panel insights">
        <h2>Insights</h2>
        <ul>
          {insights.map((i, idx) => (
            <li key={idx} className={`insight ${i.level}`}>
              <strong>{i.title}</strong>
              <span>{i.detail}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel wide">
        <h2>Daily spending</h2>
        <div className="chart">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={a.daily} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="#E3E8F0" />
              <XAxis dataKey="date" tickFormatter={(d) => Number(d.slice(8))} interval={2} tickLine={false} axisLine={false} fontSize={12} />
              <YAxis tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : v)} width={40} tickLine={false} axisLine={false} fontSize={12} />
              <Tooltip formatter={(v) => [money0(v), "Spent"]} labelFormatter={shortDate} cursor={{ fill: "#EDF0F5" }} />
              <Bar dataKey="expense" fill={EXPENSE} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="panel">
        <h2>Where it went</h2>
        {a.by_category.length === 0 ? (
          <p className="muted">No expenses yet this month.</p>
        ) : (
          <div className="cats">
            <div className="donut">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={a.by_category} dataKey="amount" nameKey="category" innerRadius={48} outerRadius={78} paddingAngle={2} stroke="none">
                    {a.by_category.map((c, i) => <Cell key={c.category} fill={PALETTE[i % PALETTE.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v, n) => [money0(v), n]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="cat-list">
              {a.by_category.map((c, i) => (
                <li key={c.category}>
                  <i className="dot" style={{ background: PALETTE[i % PALETTE.length] }} />
                  <span>{c.category}</span>
                  <span className="muted">{percent(c.share)}</span>
                  <strong>{money(c.amount)}</strong>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="panel">
        <h2>Last six months</h2>
        <div className="chart short">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={a.trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="#E3E8F0" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
              <YAxis tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : v)} width={40} tickLine={false} axisLine={false} fontSize={12} />
              <Tooltip formatter={(v, n) => [money0(v), n === "income" ? "Income" : "Expenses"]} cursor={{ fill: "#EDF0F5" }} />
              <Legend formatter={(v) => (v === "income" ? "Income" : "Expenses")} iconType="circle" iconSize={8} />
              <Bar dataKey="income" fill={INCOME} radius={[3, 3, 0, 0]} />
              <Bar dataKey="expense" fill={EXPENSE} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="panel wide">
        <div className="panel-head">
          <h2>Recent transactions</h2>
          <button className="link" onClick={onSeeAll}>See all</button>
        </div>
        <ul className="recent">
          {transactions.slice(0, 6).map((t) => (
            <li key={t.id}>
              <button className="recent-row" onClick={() => onEdit(t)} aria-label={`Edit ${t.description || t.category}`}>
                <span className="muted nowrap">{shortDate(t.date)}</span>
                <span className="grow">{t.description || t.category}</span>
                <span className="chip">{t.category}</span>
                <span className={`num ${t.type}`}>{t.type === "income" ? "+" : "−"}{money(t.amount)}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
