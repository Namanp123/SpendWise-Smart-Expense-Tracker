const BASE = (import.meta.env.VITE_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

async function request(path, options = {}) {
  let res;
  try {
    res = await fetch(`${BASE}/api${path}`, {
      headers: { "Content-Type": "application/json" },
      ...options,
    });
  } catch {
    throw new Error("Can't reach the SpendWise API. Make sure the backend is running on " + BASE);
  }
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (typeof body.detail === "string") message = body.detail;
      else if (Array.isArray(body.detail)) message = body.detail.map((d) => d.msg.replace(/^Value error, /, "")).join(". ");
    } catch { /* keep default message */ }
    throw new Error(message);
  }
  return res.status === 204 ? null : res.json();
}

const json = (method, body) => ({ method, body: JSON.stringify(body) });

export const api = {
  config: () => request("/config"),
  categories: () => request("/categories"),
  analytics: (month) => request(`/analytics?month=${month}`),
  insights: (month) => request(`/insights?month=${month}`),
  budgets: (month) => request(`/budgets?month=${month}`),
  transactions: (month) => request(`/transactions?month=${month}`),
  createTransaction: (tx) => request("/transactions", json("POST", tx)),
  updateTransaction: (id, tx) => request(`/transactions/${id}`, json("PUT", tx)),
  deleteTransaction: (id) => request(`/transactions/${id}`, { method: "DELETE" }),
  saveBudget: (b) => request("/budgets", json("PUT", b)),
  deleteBudget: (id) => request(`/budgets/${id}`, { method: "DELETE" }),
  seedDemo: () => request("/seed-demo", { method: "POST" }),
};
