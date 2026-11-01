import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts";
import {
  ArrowDownRight, ArrowLeftRight, ArrowUpRight, CalendarDays, ChartNoAxesCombined,
  ChevronRight, CircleHelp, LayoutDashboard, LogOut, Menu, Plus, Search, Send,
  Settings, Sparkles, Sprout, Tags, Target, Trash2, Wallet, X,
} from "lucide-react";
import { getDashboardSummary } from "./api/dashboard";
import {
  createBudget, createCategory, createTransaction, deleteBudget, deleteCategory,
  deleteTransaction, getBudgets, getCategories, getTransactions, updateBudget,
  updateCategory, updateTransaction,
} from "./api/finance";
import { useAuth } from "./context/useAuth";
import Login from "./components/Login";
import "./App.css";

const navigation = [
  { label: "Overview", icon: LayoutDashboard },
  { label: "Transactions", icon: ArrowLeftRight },
  { label: "Categories", icon: Tags },
  { label: "Budgets", icon: Target },
  { label: "Analytics", icon: ChartNoAxesCombined },
];
const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const palette = ["#A78BFA", "#F5A36C", "#64B5D9", "#E88CB6", "#83C99A", "#F1D16B"];
const monthValue = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
const dateValue = (date) => `${monthValue(date)}-${String(date.getDate()).padStart(2, "0")}`;
const displayDate = (date) => new Date(`${date}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
const responseList = (data) => Array.isArray(data) ? data : data?.results || [];

function App() {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <FinanceWorkspace key={localStorage.getItem("username")} /> : <Login />;
}

function FinanceWorkspace() {
  const { logout } = useAuth();
  const [today] = useState(() => new Date());
  const [activePage, setActivePage] = useState("Overview");
  const [transactions, setTransactions] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [selectedMonth, setSelectedMonth] = useState(() => monthValue(today));
  const [mobileNav, setMobileNav] = useState(false);
  const [modal, setModal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");

  const refresh = useCallback(async () => {
    const [summaryData, transactionData, budgetData, categoryData] = await Promise.all([
      getDashboardSummary(), getTransactions(),
      getBudgets(Number(selectedMonth.slice(5)), Number(selectedMonth.slice(0, 4))), getCategories(),
    ]);
    setSummary(summaryData);
    setTransactions(responseList(transactionData));
    setBudgets(responseList(budgetData));
    setCategories(responseList(categoryData));
  }, [selectedMonth]);

  useEffect(() => {
    let current = true;
    const [year, month] = selectedMonth.split("-").map(Number);
    Promise.all([getDashboardSummary(), getTransactions(), getBudgets(month, year), getCategories()]).then(([summaryData, transactionData, budgetData, categoryData]) => {
      if (!current) return;
      setSummary(summaryData);
      setTransactions(responseList(transactionData));
      setBudgets(responseList(budgetData));
      setCategories(responseList(categoryData));
      if (current) setError("");
    }).catch((cause) => {
      console.error("Finance data error:", cause);
      if (current) setError("We couldn't load your finance data. Check the backend connection and reload.");
    }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [selectedMonth]);

  const categoriesById = useMemo(() => new Map(categories.map((category) => [category.id, category.name])), [categories]);
  const filteredTransactions = useMemo(() => transactions.filter((item) => {
    const category = categoriesById.get(item.category) || "Uncategorized";
    const queryMatch = `${item.description} ${category}`.toLowerCase().includes(search.trim().toLowerCase());
    return queryMatch && (filter === "all" || item.type === filter);
  }), [transactions, categoriesById, search, filter]);

  const monthlyData = useMemo(() => Array.from({ length: 6 }, (_, index) => {
    const monthIndex = today.getFullYear() * 12 + today.getMonth() - (5 - index);
    const year = Math.floor(monthIndex / 12);
    const month = monthIndex % 12;
    const prefix = `${year}-${String(month + 1).padStart(2, "0")}`;
    const monthItems = transactions.filter((item) => item.transaction_date.startsWith(prefix));
    return {
      month: monthNames[month].slice(0, 3),
      income: monthItems.filter((item) => item.type === "income").reduce((total, item) => total + Number(item.amount), 0),
      expenses: monthItems.filter((item) => item.type === "expense").reduce((total, item) => total + Number(item.amount), 0),
    };
  }), [transactions, today]);

  const spendingData = useMemo(() => {
    const totals = new Map();
    transactions.filter((item) => item.type === "expense").forEach((item) => {
      const name = categoriesById.get(item.category) || "Uncategorized";
      totals.set(name, (totals.get(name) || 0) + Number(item.amount));
    });
    return [...totals.entries()].map(([name, value], index) => ({ name, value, color: palette[index % palette.length] }));
  }, [transactions, categoriesById]);

  const money = useCallback((value) => new Intl.NumberFormat("en-IN", {
    style: "currency", currency: "INR", maximumFractionDigits: 0,
  }).format(Number(value || 0)), []);

  const openTransaction = (item = null) => setModal({ kind: "transaction", item });
  const openBudget = (item = null) => setModal({ kind: "budget", item });
  const runAction = async (action) => {
    setSaving(true);
    setError("");
    try {
      await action();
      await refresh();
      setModal(null);
    } catch (cause) {
      const data = cause.response?.data;
      setError(data ? Object.values(data).flat().join(" ") : "That change couldn't be saved. Please try again.");
    } finally { setSaving(false); }
  };

  const submitModal = (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    if (modal.kind === "transaction") {
      const body = { description: data.description.trim(), amount: data.amount, type: data.type, category: data.category ? Number(data.category) : null, transaction_date: data.transaction_date };
      runAction(() => modal.item ? updateTransaction(modal.item.id, body) : createTransaction(body));
    } else if (modal.kind === "budget") {
      const body = { category: Number(data.category), amount: data.amount, month: Number(data.month.slice(5)), year: Number(data.month.slice(0, 4)) };
      runAction(() => modal.item ? updateBudget(modal.item.id, body) : createBudget(body));
    } else if (modal.kind === "category") {
      const body = { name: data.name.trim() };
      runAction(() => modal.item ? updateCategory(modal.item.id, body) : createCategory(body));
    }
  };

  const removeRecord = (label, action) => {
    const detail = label === "category" ? " Transactions will become uncategorized and budgets using it will be removed." : " This cannot be undone.";
    if (window.confirm(`Delete this ${label}?${detail}`)) runAction(action);
  };

  const sendMessage = (event) => {
    event.preventDefault();
    const question = chatInput.trim();
    if (!question) return;
    const lowered = question.toLowerCase();
    const expenses = Number(summary?.total_expenses || 0);
    const income = Number(summary?.total_income || 0);
    const topCategory = spendingData.slice().sort((a, b) => b.value - a.value)[0];
    let answer = `You have ${transactions.length} transactions recorded. Your total income is ${money(income)} and expenses are ${money(expenses)}.`;
    if (lowered.includes("spend") || lowered.includes("category")) {
      answer = topCategory ? `Your largest spending category is ${topCategory.name} at ${money(topCategory.value)} across your recorded transactions.` : "There aren't any expenses recorded yet. Add a transaction and I can summarize your spending.";
    } else if (lowered.includes("save") || lowered.includes("balance")) {
      answer = `Your current recorded balance is ${money(income - expenses)}. ${income > 0 ? `You've kept ${Math.max(0, Math.round((income - expenses) / income * 100))}% of your recorded income.` : "Record income and expenses to see your savings rate."}`;
    } else if (lowered.includes("budget")) {
      answer = budgets.length ? `You have ${budgets.length} budgets for the selected month. ${budgets.filter((budget) => Number(budget.spent) > Number(budget.amount)).length} are over their limit.` : "There are no budgets for the selected month yet. Create one from the Budgets page.";
    }
    setMessages((previous) => [...previous, { role: "user", text: question }, { role: "assistant", text: answer }]);
    setChatInput("");
  };

  const pageTitle = activePage === "Overview" ? "Your financial garden" : activePage;
  const transactionRows = (items) => items.map((item) => (
    <div className="transaction-row" key={item.id}>
      <div className={`transaction-icon ${item.type === "income" ? "green" : "orange"}`}>{item.type === "income" ? <ArrowDownRight size={18} /> : <ArrowUpRight size={18} />}</div>
      <div className="transaction-details"><strong>{item.description}</strong><span>{categoriesById.get(item.category) || "Uncategorized"} · {displayDate(item.transaction_date)}</span></div>
      <strong className={`transaction-amount ${item.type}`}>{item.type === "income" ? "+" : "−"}{money(item.amount)}</strong>
      <button className="row-action" aria-label={`Edit ${item.description}`} onClick={() => openTransaction(item)}>Edit</button>
      <button className="row-action danger-action" aria-label={`Delete ${item.description}`} onClick={() => removeRecord("transaction", () => deleteTransaction(item.id))}><Trash2 size={16} /></button>
    </div>
  ));

  return (
    <div className="app-shell">
      {mobileNav && <button className="mobile-overlay" aria-label="Close navigation" onClick={() => setMobileNav(false)} />}
      <aside className={`sidebar ${mobileNav ? "sidebar-open" : ""}`}>
        <div className="brand"><div className="brand-icon"><Sprout size={25} /></div><span>sprout<span className="brand-dot">.</span></span></div>
        <div className="profile-mini"><div className="profile-avatar">{(localStorage.getItem("username") || "U").slice(0, 1).toUpperCase()}</div><div><strong>{localStorage.getItem("username") || "Your account"}</strong><span>Personal account</span></div></div>
        <span className="nav-label">WORKSPACE</span>
        <nav className="main-nav">{navigation.map(({ label, icon: Icon }) => <button key={label} className={`nav-item ${activePage === label ? "active" : ""}`} onClick={() => { setActivePage(label); setMobileNav(false); }}><Icon size={18} /><span>{label}</span>{label === "Transactions" && <span className="nav-count">{transactions.length}</span>}</button>)}</nav>
        <div className="sidebar-divider" /><span className="nav-label">PERSONAL</span>
        <nav className="main-nav">
          <button className={`nav-item ${activePage === "AI Assistant" ? "active" : ""}`} onClick={() => { setActivePage("AI Assistant"); setMobileNav(false); }}><Sparkles size={18} /><span>Money assistant</span></button>
          <button className={`nav-item ${activePage === "Settings" ? "active" : ""}`} onClick={() => { setActivePage("Settings"); setMobileNav(false); }}><Settings size={18} /><span>Settings</span></button>
          <button className={`nav-item ${activePage === "Help" ? "active" : ""}`} onClick={() => { setActivePage("Help"); setMobileNav(false); }}><CircleHelp size={18} /><span>Help & support</span></button>
        </nav>
        <div className="sidebar-spacer" />
        <div className="sidebar-tip"><div className="tip-icon"><Sprout size={20} /></div><strong>Your data, your decisions.</strong><p>Your financial records are private to your account.</p></div>
        <div className="sidebar-footer"><button className="logout-button" type="button" onClick={logout}><LogOut size={17} /><span>Log out</span></button></div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="topbar-left"><button className="mobile-menu icon-button" aria-label="Open navigation" onClick={() => setMobileNav(true)}><Menu size={21} /></button><div className="breadcrumb"><span>Workspace</span><ChevronRight size={14} /><strong>{activePage}</strong></div></div>
          <div className="topbar-actions">
            <label className="search-box"><Search size={16} /><input value={search} onChange={(event) => { setSearch(event.target.value); if (event.target.value) setActivePage("Transactions"); }} placeholder="Search transactions..." /><button type="button" aria-label="Clear search" onClick={() => setSearch("")}><X size={14} /></button></label>
            <button className="topbar-logout" type="button" onClick={logout}><LogOut size={16} /><span>Log out</span></button>
          </div>
        </header>

        <div className="dashboard-content">
          <div className="welcome-row"><div><div className="eyebrow"><span className="eyebrow-dot" /> YOUR MONEY, YOUR GROWTH</div><h1>{pageTitle}</h1><p className="welcome-subtitle">{activePage === "Overview" ? "A live view of your recorded income, expenses, and budgets." : `Manage your ${activePage.toLowerCase()} using your saved finance data.`}</p></div>
            <div className="welcome-actions">{["Overview", "Budgets"].includes(activePage) && <label className="period-select"><CalendarDays size={16} /><input aria-label="Budget month" type="month" value={selectedMonth} onChange={(event) => { setLoading(true); setSelectedMonth(event.target.value); }} /></label>}
              {!["Settings", "AI Assistant", "Help"].includes(activePage) && <button className="primary-button" onClick={() => activePage === "Budgets" ? openBudget() : activePage === "Categories" ? setModal({ kind: "category", item: null }) : openTransaction()}><Plus size={17} /> Add {activePage === "Budgets" ? "budget" : activePage === "Categories" ? "category" : "transaction"}</button>}
            </div>
          </div>
          {error && <div className="page-notice" role="alert">{error}<button onClick={() => refresh().then(() => setError("")).catch(() => {})}>Retry</button></div>}
          {loading ? <div className="panel loading-state">Loading your finance data…</div> : <>
            {activePage === "Overview" && <>
              <section className="summary-grid">
                {[["Total balance", summary?.balance, Wallet], ["Total expenses", summary?.total_expenses, ArrowUpRight], ["Total income", summary?.total_income, ArrowDownRight], ["Budget remaining", budgets.reduce((total, item) => total + Number(item.remaining || 0), 0), Target]].map(([label, value, Icon], index) => <article className={`summary-card ${["balance-card", "expense-card", "income-card", "savings-card"][index]}`} key={label}><div className="card-topline"><span>{label}</span><div className="metric-icon"><Icon size={18} /></div></div><div className="metric-value">{money(value)}</div><div className="metric-bottom"><span>{label === "Budget remaining" ? `Across ${budgets.length} budgets this month` : `${transactions.length} recorded transactions`}</span></div></article>)}
              </section>
              <section className="main-grid">
                <article className="panel chart-panel"><SectionTitle title="Income vs. expenses" subtitle="Based on your recorded transactions" /><div className="chart-legend"><span><i className="legend-dot income-dot" /> Income</span><span><i className="legend-dot expense-dot" /> Expenses</span></div><FinanceChart data={monthlyData} money={money} /></article>
                <article className="panel spending-panel"><SectionTitle title="Where it goes" subtitle="Recorded expenses by category" /><SpendingChart data={spendingData} money={money} /><div className="category-legend">{spendingData.map((item) => <div className="category-row" key={item.name}><span className="category-name"><i style={{ background: item.color }} />{item.name}</span><strong>{money(item.value)}</strong></div>)}{!spendingData.length && <EmptyState text="No expenses recorded yet." />}</div></article>
              </section>
              <section className="bottom-grid">
                <article className="panel transactions-panel"><SectionTitle title="Recent transactions" subtitle="Your latest saved activity" action={<button className="text-action" onClick={() => setActivePage("Transactions")}>View all <ChevronRight size={15} /></button>} /><div className="transaction-toolbar"><FilterTabs filter={filter} setFilter={setFilter} /></div><div className="transaction-list">{transactionRows(filteredTransactions.slice(0, 6))}{!filteredTransactions.length && <EmptyState text="No transactions match this view." />}</div></article>
                <article className="panel budget-panel"><SectionTitle title="Budgets" subtitle={`For ${monthNames[Number(selectedMonth.slice(5)) - 1]} ${selectedMonth.slice(0, 4)}`} action={<button className="text-action" onClick={() => setActivePage("Budgets")}>Manage <ChevronRight size={15} /></button>} /><BudgetList budgets={budgets} money={money} onEdit={openBudget} onDelete={(item) => removeRecord("budget", () => deleteBudget(item.id))} /><button className="budget-link" onClick={() => openBudget()}>Create budget <Plus size={15} /></button></article>
              </section>
            </>}
            {activePage === "Transactions" && <section className="panel management-panel"><div className="transaction-toolbar"><FilterTabs filter={filter} setFilter={setFilter} /><span>{filteredTransactions.length} transactions</span></div><div className="transaction-list">{transactionRows(filteredTransactions)}{!filteredTransactions.length && <EmptyState text={search ? "No matching transactions." : "No transactions yet. Add your first transaction."} />}</div></section>}
            {activePage === "Categories" && <section className="panel management-panel"><SectionTitle title="Your categories" subtitle="Default categories are shared. Your categories can be renamed or removed." /><div className="management-list">{categories.map((item) => <div className="management-row" key={item.id}><span className="category-swatch" style={{ background: palette[item.id % palette.length] }} /><strong>{item.name}</strong><span>{item.owner ? "Custom" : "Default"}</span>{item.owner && <><button className="row-action" onClick={() => setModal({ kind: "category", item })}>Rename</button><button className="row-action danger-action" aria-label={`Delete ${item.name}`} onClick={() => removeRecord("category", () => deleteCategory(item.id))}><Trash2 size={16} /></button></>}</div>)}{!categories.length && <EmptyState text="No categories available yet." />}</div></section>}
            {activePage === "Budgets" && <section className="panel management-panel"><SectionTitle title="Monthly budgets" subtitle="Set a spending limit for each category." /><BudgetList budgets={budgets} money={money} onEdit={openBudget} onDelete={(item) => removeRecord("budget", () => deleteBudget(item.id))} showActions /><button className="primary-button" onClick={() => openBudget()}><Plus size={17} /> Create budget</button></section>}
            {activePage === "Analytics" && <><section className="main-grid"><article className="panel chart-panel"><SectionTitle title="Income vs. expenses" subtitle="Monthly totals from your transactions" /><FinanceChart data={monthlyData} money={money} /></article><article className="panel spending-panel"><SectionTitle title="Expense categories" subtitle="All recorded expenses" /><SpendingChart data={spendingData} money={money} /><div className="category-legend">{spendingData.map((item) => <div className="category-row" key={item.name}><span className="category-name"><i style={{ background: item.color }} />{item.name}</span><strong>{money(item.value)}</strong></div>)}</div></article></section></>}
            {activePage === "Settings" && <section className="panel management-panel"><SectionTitle title="Account" subtitle="Your Sprout account details." /><div className="setting-control"><strong>Signed in as</strong><span>{localStorage.getItem("username") || "Your account"}</span></div><div className="setting-control"><strong>Display currency</strong><span>Indian Rupee (INR)</span></div><button className="logout-button setting-logout" onClick={logout}><LogOut size={17} /> Log out</button></section>}
            {activePage === "Help" && <section className="panel management-panel"><SectionTitle title="Help & support" subtitle="How to use your Sprout finance tracker." /><div className="help-content"><h3>Record an expense or income</h3><p>Use Add transaction to save a description, amount, date, and optional category. Your totals and charts update from saved records.</p><h3>Set a budget</h3><p>Open Budgets, choose a category and month, and enter a spending limit. Sprout calculates spending from matching expense transactions.</p><h3>Manage your data</h3><p>Use the Transactions and Categories pages to edit or delete your own records. Default categories are shared and cannot be renamed or deleted.</p><h3>Sign out</h3><p>Use Log out in the sidebar or top bar to clear this browser's sign-in session.</p></div></section>}
            {activePage === "AI Assistant" && <section className="panel assistant-page"><SectionTitle title="Money assistant" subtitle="Answers are calculated from your saved Sprout account data." /><div className="chat-messages">{messages.length ? messages.map((message, index) => <div className={`chat-message ${message.role}`} key={index}>{message.text}</div>) : <div className="empty-state">Ask about your recorded spending, savings, or budgets.</div>}</div><div className="suggestion-chips"><button onClick={() => setChatInput("How am I spending?")}>My spending</button><button onClick={() => setChatInput("How can I save more?")}>Savings</button><button onClick={() => setChatInput("How are my budgets?")}>Budgets</button></div><form className="chat-input" onSubmit={sendMessage}><input value={chatInput} onChange={(event) => setChatInput(event.target.value)} placeholder="Ask about your money…" /><button type="submit" aria-label="Send message"><Send size={17} /></button></form></section>}
          </>}
          <footer className="app-footer"><span>© {today.getFullYear()} Sprout</span><span>Your financial data, clearly presented.</span></footer>
        </div>
      </main>

      {activePage !== "AI Assistant" && <button className="fox-fab" onClick={() => setActivePage("AI Assistant")} aria-label="Open money assistant"><span className="fox-face">🌱</span></button>}
      {modal && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setModal(null); }}><form className="transaction-modal" onSubmit={submitModal}>
        <div className="modal-heading"><div><span className="modal-eyebrow">SPROUT</span><h2>{modal.kind === "transaction" ? modal.item ? "Edit transaction" : "Add transaction" : modal.kind === "budget" ? modal.item ? "Edit budget" : "Create budget" : modal.item ? "Rename category" : "Add category"}</h2><p>Your changes are saved to your account.</p></div><button type="button" className="icon-button" aria-label="Close dialog" disabled={saving} onClick={() => setModal(null)}><X size={20} /></button></div>
        {error && <p className="form-error" role="alert">{error}</p>}
        {modal.kind === "transaction" && <><div className="type-toggle"><label><input type="radio" name="type" value="expense" defaultChecked={modal.item?.type !== "income"} /> Expense</label><label><input type="radio" name="type" value="income" defaultChecked={modal.item?.type === "income"} /> Income</label></div><label className="form-label">Description<input name="description" required maxLength="240" defaultValue={modal.item?.description || ""} /></label><label className="form-label">Amount<input name="amount" required type="number" min="0.01" step="0.01" defaultValue={modal.item?.amount || ""} /></label><label className="form-label">Date<input name="transaction_date" required type="date" defaultValue={modal.item?.transaction_date || dateValue(today)} /></label><label className="form-label">Category<select name="category" defaultValue={modal.item?.category || ""}><option value="">Uncategorized</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label></>}
        {modal.kind === "budget" && <><label className="form-label">Category<select name="category" required defaultValue={modal.item?.category || ""}><option value="" disabled>Select a category</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="form-label">Monthly limit<input name="amount" required type="number" min="0.01" step="0.01" defaultValue={modal.item?.amount || ""} /></label><label className="form-label">Month<input name="month" required type="month" defaultValue={modal.item ? `${modal.item.year}-${String(modal.item.month).padStart(2, "0")}` : selectedMonth} /></label></>}
        {modal.kind === "category" && <label className="form-label">Category name<input name="name" required maxLength="60" defaultValue={modal.item?.name || ""} /></label>}
        <div className="modal-actions"><button type="button" className="cancel-button" onClick={() => setModal(null)} disabled={saving}>Cancel</button><button type="submit" className="primary-button" disabled={saving}>{saving ? "Saving…" : "Save"}</button></div>
      </form></div>}
    </div>
  );
}

function FilterTabs({ filter, setFilter }) {
  return <div className="filter-tabs">{["all", "expense", "income"].map((item) => <button key={item} className={filter === item ? "selected" : ""} onClick={() => setFilter(item)}>{item[0].toUpperCase() + item.slice(1)}</button>)}</div>;
}

function FinanceChart({ data, money }) {
  return <div className="main-chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={data} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}><defs><linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#8CCF9F" stopOpacity={0.23} /><stop offset="100%" stopColor="#8CCF9F" stopOpacity={0} /></linearGradient><linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#A78BFA" stopOpacity={0.2} /><stop offset="100%" stopColor="#A78BFA" stopOpacity={0} /></linearGradient></defs><CartesianGrid stroke="#29263D" strokeDasharray="3 5" vertical={false} /><XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "#85839B", fontSize: 11 }} dy={10} /><YAxis axisLine={false} tickLine={false} tick={{ fill: "#85839B", fontSize: 10 }} tickFormatter={(value) => `${value / 1000}k`} /><Tooltip contentStyle={{ background: "#211D36", border: "1px solid #3A3455", borderRadius: 12, color: "#fff", fontSize: 12 }} formatter={(value) => money(value)} /><Area type="monotone" dataKey="income" stroke="#8CCF9F" strokeWidth={2.5} fill="url(#incomeGradient)" /><Area type="monotone" dataKey="expenses" stroke="#A78BFA" strokeWidth={2.5} fill="url(#expenseGradient)" /></AreaChart></ResponsiveContainer></div>;
}

function SpendingChart({ data, money }) {
  return <div className="donut-wrap"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={data} dataKey="value" nameKey="name" innerRadius="67%" outerRadius="88%" paddingAngle={4} stroke="none">{data.map((entry) => <Cell key={entry.name} fill={entry.color} />)}</Pie><Tooltip formatter={(value) => money(value)} /></PieChart></ResponsiveContainer><div className="donut-center"><strong>{money(data.reduce((sum, item) => sum + item.value, 0))}</strong><span>Total spent</span></div></div>;
}

function BudgetList({ budgets, money, onEdit, onDelete, showActions = false }) {
  return <div className="budget-list">{budgets.map((budget, index) => {
    const limit = Number(budget.amount);
    const spent = Number(budget.spent);
    const percentage = limit > 0 ? spent / limit * 100 : 0;
    return <div className="budget-item" key={budget.id}><div className="budget-heading"><div className="budget-name"><span className="budget-icon" style={{ color: palette[index % palette.length] }}><Target size={16} /></span><strong>{budget.category_name}</strong></div><span>{Math.round(percentage)}%</span></div><div className="progress-track"><div style={{ width: `${Math.min(100, percentage)}%`, background: palette[index % palette.length] }} /></div><div className="budget-foot"><span>{money(spent)} spent</span><span>of {money(limit)}</span></div>{showActions && <div className="management-actions"><button className="row-action" onClick={() => onEdit(budget)}>Edit</button><button className="row-action danger-action" aria-label={`Delete ${budget.category_name} budget`} onClick={() => onDelete(budget)}><Trash2 size={16} /></button></div>}</div>;
  })}{!budgets.length && <EmptyState text="No budgets for this month. Create one to start tracking a limit." />}</div>;
}

function SectionTitle({ title, subtitle, action }) {
  return <div className="section-heading"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>{action}</div>;
}

function EmptyState({ text }) { return <div className="empty-state">{text}</div>; }

export default App;
