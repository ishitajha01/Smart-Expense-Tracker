import { getDashboardSummary } from "./api/dashboard";
import { createTransaction, getBudgets, getCategories, getTransactions } from "./api/finance";
import { useEffect, useState } from "react";
import { useAuth } from "./context/AuthContext";
import Login from "./components/Login";
import {
  LayoutDashboard, ArrowLeftRight, LogOut, Tags, Target, ChartNoAxesCombined,
  Settings, CircleHelp, Plus, Search, Bell, ChevronDown,
  ArrowUpRight, ArrowDownRight, Wallet, TrendingUp, PiggyBank,
  Utensils, CarFront, ShoppingBag, HeartPulse, House, Coffee,
  MoreHorizontal, CalendarDays, Sparkles, X, Send, Menu,
  Sprout, ChevronRight, Check, Filter, SlidersHorizontal
} from "lucide-react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis
} from "recharts";
import "./App.css";

const navigation = [
  { label: "Overview", icon: LayoutDashboard },
  { label: "Transactions", icon: ArrowLeftRight },
  { label: "Categories", icon: Tags },
  { label: "Budgets", icon: Target },
  { label: "Analytics", icon: ChartNoAxesCombined },
];


const categoryStyle = (name = "") => {
  const normalized = name.toLowerCase();
  if (normalized.includes("transport")) return { icon: CarFront, color: "blue", chartColor: "#64B5D9" };
  if (normalized.includes("shop")) return { icon: ShoppingBag, color: "purple", chartColor: "#F5A36C" };
  if (normalized.includes("health")) return { icon: HeartPulse, color: "pink", chartColor: "#E88CB6" };
  if (normalized.includes("house") || normalized.includes("rent")) return { icon: House, color: "purple", chartColor: "#83C99A" };
  if (normalized.includes("salary") || normalized.includes("income")) return { icon: Wallet, color: "green", chartColor: "#8CCF9F" };
  return { icon: Utensils, color: "orange", chartColor: "#A78BFA" };
};

const money = (amount) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);

function SectionTitle({ title, subtitle, action }) {
  return (
    <div className="section-heading">
      <div>
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

function App() {
  const { isAuthenticated, logout } = useAuth();
  const [activePage, setActivePage] = useState("Overview");
  const [transactions, setTransactions] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [dataError, setDataError] = useState("");
  const [savingTransaction, setSavingTransaction] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState("November 2026");
  const [filter, setFilter] = useState("All");
  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState([
    { role: "assistant", text: "Hey there! I'm Sprout, your little money companion. 🌱 I'm here to help your finances grow. What would you like to explore?" }
  ]);
  const [form, setForm] = useState({
    name: "", amount: "", category: "", type: "expense"
  });
  const [dashboardSummary, setDashboardSummary] = useState(null);
  const [summaryError, setSummaryError] = useState("");

  useEffect(() => {
    if (!isAuthenticated) return;
    let active = true;
    const [monthName, year] = period.split(" ");
    const month = new Date(`${monthName} 1, ${year}`).getMonth() + 1;
    Promise.all([getDashboardSummary(), getTransactions(), getBudgets(month, Number(year)), getCategories()])
      .then(([summary, transactionData, budgetData, categoryData]) => {
        if (!active) return;
        setDashboardSummary(summary);
        setTransactions((Array.isArray(transactionData) ? transactionData : transactionData.results || []).map((item) => {
          const category = categoryData.find((entry) => entry.id === item.category)?.name || "Uncategorized";
          const style = categoryStyle(category);
          return { id: item.id, name: item.description, category, dateKey: item.transaction_date, date: new Date(`${item.transaction_date}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }), amount: Number(item.amount), type: item.type, ...style };
        }));
        setBudgets((Array.isArray(budgetData) ? budgetData : budgetData.results || []).map((item) => ({ ...item, name: item.category_name, spent: Number(item.spent), limit: Number(item.amount), ...categoryStyle(item.category_name) })));
        setCategories(categoryData);
        setForm((previous) => ({ ...previous, category: previous.category || String(categoryData[0]?.id || "") }));
        setSummaryError("");
        setDataError("");
      })
      .catch((error) => {
        console.error("Finance data error:", error);
        if (active) setDataError("Couldn't load your transactions or budgets. Check that the backend is running and try again.");
      });
    return () => { active = false; };
  }, [isAuthenticated, period]);

  if (!isAuthenticated) return <Login />;

  const totals = {
    income: Number(dashboardSummary?.total_income ?? 0),
    expenses: Number(dashboardSummary?.total_expenses ?? 0),
    savings: Number(dashboardSummary?.total_income ?? 0) - Number(dashboardSummary?.total_expenses ?? 0),
  };
  const monthlyData = Array.from({ length: 6 }, (_, index) => {
    const date = new Date();
    date.setDate(1);
    date.setMonth(date.getMonth() - (5 - index));
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const monthTransactions = transactions.filter((transaction) => transaction.dateKey?.startsWith(key));
    return {
      month: date.toLocaleDateString("en-IN", { month: "short" }),
      income: monthTransactions.filter((transaction) => transaction.type === "income").reduce((sum, item) => sum + item.amount, 0),
      expenses: monthTransactions.filter((transaction) => transaction.type === "expense").reduce((sum, item) => sum + item.amount, 0),
    };
  });

  const filteredTransactions = transactions.filter((transaction) => {
    const matchesSearch = `${transaction.name} ${transaction.category}`
      .toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === "All" || transaction.type === filter.toLowerCase();
    return matchesSearch && matchesFilter;
  });
  const spendingData = (dashboardSummary?.category_expenses || []).map((item) => ({
    name: item.category || "Uncategorized", value: Number(item.total), color: categoryStyle(item.category).chartColor,
  }));

  const addTransaction = async (event) => {
    event.preventDefault();
    if (!form.name.trim() || !form.amount || Number(form.amount) <= 0) return;
    setSavingTransaction(true);
    try {
      const today = new Date();
      const transactionDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
      await createTransaction({ description: form.name.trim(), amount: form.amount, type: form.type, category: form.category ? Number(form.category) : null, transaction_date: transactionDate });
      const [transactionData, summary, budgetData] = await Promise.all([getTransactions(), getDashboardSummary(), getBudgets(new Date(`${period.split(" ")[0]} 1, ${period.split(" ")[1]}`).getMonth() + 1, Number(period.split(" ")[1]))]);
      setDashboardSummary(summary);
      setBudgets((Array.isArray(budgetData) ? budgetData : budgetData.results || []).map((item) => ({ ...item, name: item.category_name, spent: Number(item.spent), limit: Number(item.amount), ...categoryStyle(item.category_name) })));
      setTransactions((Array.isArray(transactionData) ? transactionData : transactionData.results || []).map((item) => {
        const category = categories.find((entry) => entry.id === item.category)?.name || "Uncategorized";
        return { id: item.id, name: item.description, category, dateKey: item.transaction_date, date: new Date(`${item.transaction_date}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }), amount: Number(item.amount), type: item.type, ...categoryStyle(category) };
      }));
      setForm({ name: "", amount: "", category: String(categories[0]?.id || ""), type: "expense" });
      setShowModal(false);
      setDataError("");
    } catch (error) {
      setDataError(error.response?.data ? Object.values(error.response.data).flat().join(" ") : "Couldn't save the transaction. Please try again.");
    } finally { setSavingTransaction(false); }
  };

  const sendMessage = (event) => {
    event.preventDefault();
    if (!chatInput.trim()) return;
    const question = chatInput.trim();
    setMessages((previous) => [
      ...previous,
      { role: "user", text: question },
      { role: "assistant", text: "That's a great question! Once I'm connected to your Sprout financial data and AI service, I'll be able to give you a personalized answer. 🌱" }
    ]);
    setChatInput("");
  };

  const pageTitle = activePage === "Overview" ? "Your financial garden" : activePage;

  return (
    <div className="app-shell">
      {sidebarOpen && <div className="mobile-overlay" onClick={() => setSidebarOpen(false)} />}

      <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-icon"><Sprout size={25} strokeWidth={2.3} /></div>
          <span>sprout<span className="brand-dot">.</span></span>
        </div>

        <div className="profile-mini">
          <div className="profile-avatar">I</div>
          <div>
            <strong>Welcome back!</strong>
            <span>Your personal space</span>
          </div>
          <ChevronDown size={15} />
        </div>

        <span className="nav-label">WORKSPACE</span>
        <nav className="main-nav">
          {navigation.map(({ label, icon: Icon }) => (
            <button
              key={label}
              className={`nav-item ${activePage === label ? "active" : ""}`}
              onClick={() => { setActivePage(label); setSidebarOpen(false); }}
            >
              <Icon size={18} />
              <span>{label}</span>
              {label === "Transactions" && <span className="nav-count">{transactions.length}</span>}
            </button>
          ))}
        </nav>

        <div className="sidebar-divider" />
        <span className="nav-label">PERSONAL</span>
        <nav className="main-nav">
          <button className={`nav-item ${activePage === "AI Assistant" ? "active" : ""}`} onClick={() => { setShowAI(true); setSidebarOpen(false); }}>
            <Sparkles size={18} /><span>AI Assistant</span><span className="new-label">NEW</span>
          </button>
          <button className={`nav-item ${activePage === "Settings" ? "active" : ""}`} onClick={() => setActivePage("Settings")}>
            <Settings size={18} /><span>Settings</span>
          </button>
          <button className="nav-item" onClick={() => setShowAI(true)}>
            <CircleHelp size={18} /><span>Help & support</span>
          </button>
        </nav>

        <div className="sidebar-spacer" />

        <div className="sidebar-tip">
          <div className="tip-icon"><Sprout size={20} /></div>
          <strong>Small steps, big growth.</strong>
          <p>Every mindful decision helps your money grow.</p>
          <span>Keep growing <span>↗</span></span>
        </div>

        <div className="sidebar-footer">
          <div className="footer-user-row">
            <div className="footer-avatar">I</div>
            <div className="footer-user">
              <strong>Your account</strong>
              <span>Personal plan</span>
            </div>
            <MoreHorizontal size={19} />
          </div>

          <button className="logout-button" type="button" onClick={logout}>
            <LogOut size={17} />
            <span>Log out</span>
          </button>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="topbar-left">
            <button className="mobile-menu icon-button" onClick={() => setSidebarOpen(true)}><Menu size={21} /></button>
            <div className="breadcrumb"><span>Workspace</span><ChevronRight size={14} /><strong>{activePage}</strong></div>
          </div>
          <div className="topbar-actions">
            <label className="search-box">
              <Search size={16} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search anything..." />
              <kbd>⌘ K</kbd>
            </label>
            <button className="icon-button notification-button" aria-label="Notifications">
              <Bell size={19} /><i />
            </button>
            <button className="topbar-logout" type="button" onClick={logout}><LogOut size={16} /><span>Log out</span></button>
          </div>
        </header>

        <div className="dashboard-content">
          <div className="welcome-row">
            <div>
              <div className="eyebrow"><span className="eyebrow-dot" /> YOUR MONEY, YOUR GROWTH</div>
              <h1>{pageTitle}<span className="heading-sparkle"> ✳</span></h1>
              <p className="welcome-subtitle">Here's what's happening with your money today.</p>
            </div>
            <div className="welcome-actions">
              <label className="period-select">
                <CalendarDays size={16} />
                <select value={period} onChange={(e) => setPeriod(e.target.value)}>
                  <option>November 2026</option>
                  <option>October 2026</option>
                  <option>September 2026</option>
                </select>
                <ChevronDown size={14} />
              </label>
              <button className="primary-button" onClick={() => setShowModal(true)}>
                <Plus size={17} /> Add transaction
              </button>
            </div>
          </div>
          {(summaryError || dataError) && <div className="page-notice">{summaryError || dataError}</div>}

          {activePage !== "Overview" && activePage !== "AI Assistant" && activePage !== "Settings" && activePage !== "Transactions" && activePage !== "Budgets" && (
            <div className="page-notice">
              <Sparkles size={18} />
              <span>This is the Sprout {activePage} workspace preview. The full feature will be connected in the next development stages.</span>
            </div>
          )}

          {activePage === "Settings" && (
            <div className="page-notice"><Settings size={18} /><span>Account settings and preferences will be added in a later stage.</span></div>
          )}

          <section className="summary-grid">
            <article className="summary-card balance-card">
              <div className="card-topline"><span>Total balance</span><div className="metric-icon"><Wallet size={18} /></div></div>
              <div className="metric-value">{money(Number(dashboardSummary?.balance ?? 0))}</div>
              <div className="metric-bottom"><span className="trend positive"><ArrowUpRight size={14} /> 12.5%</span><span>vs. last month</span></div>
              <div className="card-decoration decoration-one" />
            </article>

            <article className="summary-card expense-card">
              <div className="card-topline"><span>Total expenses</span><div className="metric-icon"><ArrowUpRight size={18} /></div></div>
              <div className="metric-value">{money(Number(dashboardSummary?.total_expenses ?? 0))}</div>
              <div className="metric-bottom"><span className="trend negative"><ArrowDownRight size={14} /> 8.2%</span><span>vs. last month</span></div>
              <div className="mini-sparkline"><svg viewBox="0 0 110 35"><path d="M0 25 C15 8 20 28 34 17 S55 29 69 12 S90 19 110 3" /></svg></div>
            </article>

            <article className="summary-card income-card">
              <div className="card-topline"><span>Total income</span><div className="metric-icon"><ArrowDownRight size={18} /></div></div>
              <div className="metric-value">{money(Number(dashboardSummary?.total_income ?? 0))}</div>
              <div className="metric-bottom"><span className="trend positive"><ArrowUpRight size={14} /> 15.3%</span><span>vs. last month</span></div>
              <div className="mini-sparkline green-spark"><svg viewBox="0 0 110 35"><path d="M0 28 C15 23 20 30 34 16 S55 25 69 10 S90 16 110 2" /></svg></div>
            </article>

            <article className="summary-card savings-card">
              <div className="card-topline"><span>Net savings</span><div className="metric-icon"><PiggyBank size={18} /></div></div>
              <div className="metric-value">{money(totals.savings)}</div>
              <div className="metric-bottom"><span className="trend positive"><TrendingUp size={14} /> Growing</span><span>this month</span></div>
              <div className="savings-decoration"><Sprout size={54} /></div>
            </article>
          </section>

          <section className="main-grid">
            <article className="panel chart-panel">
              <SectionTitle
                title="Income vs. expenses"
                subtitle="See how your money flows over time"
                action={<button className="subtle-select">Last 6 months <ChevronDown size={13} /></button>}
              />
              <div className="chart-legend">
                <span><i className="legend-dot income-dot" /> Income</span>
                <span><i className="legend-dot expense-dot" /> Expenses</span>
              </div>
              <div className="main-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthlyData} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
                    <defs>
                      <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#8CCF9F" stopOpacity={0.23} />
                        <stop offset="100%" stopColor="#8CCF9F" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#A78BFA" stopOpacity={0.2} />
                        <stop offset="100%" stopColor="#A78BFA" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#29263D" strokeDasharray="3 5" vertical={false} />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "#85839B", fontSize: 11 }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: "#85839B", fontSize: 10 }} tickFormatter={(v) => `${v / 1000}k`} />
                    <Tooltip contentStyle={{ background: "#211D36", border: "1px solid #3A3455", borderRadius: 12, color: "#fff", fontSize: 12 }} formatter={(value) => money(value)} />
                    <Area type="monotone" dataKey="income" stroke="#8CCF9F" strokeWidth={2.5} fill="url(#incomeGradient)" />
                    <Area type="monotone" dataKey="expenses" stroke="#A78BFA" strokeWidth={2.5} fill="url(#expenseGradient)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </article>

            <article className="panel spending-panel">
              <SectionTitle title="Where it goes" subtitle="Your spending breakdown" action={<button className="dots-button"><MoreHorizontal size={19} /></button>} />
              <div className="donut-wrap">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={spendingData} dataKey="value" nameKey="name" innerRadius="67%" outerRadius="88%" paddingAngle={4} stroke="none">
                      {spendingData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: "#211D36", border: "1px solid #3A3455", borderRadius: 12, color: "#fff", fontSize: 12 }} formatter={(value) => money(value)} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="donut-center"><strong>{money(Number(dashboardSummary?.total_expenses ?? 0))}</strong><span>Total spent</span></div>
              </div>
              <div className="category-legend">
                {spendingData.map((item) => (
                  <div className="category-row" key={item.name}>
                    <span className="category-name"><i style={{ background: item.color }} />{item.name}</span>
                    <strong>{money(item.value)}</strong>
                  </div>
                ))}
              </div>
            </article>
          </section>

          <section className="bottom-grid">
            <article className="panel transactions-panel">
              <SectionTitle
                title="Recent transactions"
                subtitle="A little look at where your money went"
                action={<button className="text-action" onClick={() => setActivePage("Transactions")}>View all <ChevronRight size={15} /></button>}
              />
              <div className="transaction-toolbar">
                <div className="filter-tabs">
                  {["All", "Expense", "Income"].map((item) => (
                    <button key={item} className={filter === item ? "selected" : ""} onClick={() => setFilter(item)}>{item}</button>
                  ))}
                </div>
                <button className="filter-button"><SlidersHorizontal size={15} /> Filter</button>
              </div>
              <div className="transaction-list">
                {filteredTransactions.length ? filteredTransactions.map((transaction) => {
                  const Icon = transaction.icon;
                  return (
                    <div className="transaction-row" key={transaction.id}>
                      <div className={`transaction-icon ${transaction.color}`}><Icon size={18} /></div>
                      <div className="transaction-details"><strong>{transaction.name}</strong><span>{transaction.category} · {transaction.date}</span></div>
                      <strong className={`transaction-amount ${transaction.type}`}>{transaction.type === "income" ? "+" : "−"}{money(transaction.amount)}</strong>
                      <button className="row-more"><MoreHorizontal size={18} /></button>
                    </div>
                  );
                }) : <div className="empty-state">No transactions found.</div>}
              </div>
            </article>

            <article className="panel budget-panel">
              <SectionTitle title="Your budgets" subtitle="Keep your spending on track" action={<button className="dots-button"><MoreHorizontal size={19} /></button>} />
              <div className="budget-list">
                {budgets.map((budget) => {
                  const Icon = budget.icon;
                  const percentage = budget.limit > 0 ? Math.round((budget.spent / budget.limit) * 100) : 0;
                  return (
                    <div className="budget-item" key={budget.name}>
                      <div className="budget-heading">
                        <div className="budget-name"><span className="budget-icon" style={{ color: budget.color }}><Icon size={16} /></span><strong>{budget.name}</strong></div>
                        <span>{percentage}%</span>
                      </div>
                      <div className="progress-track"><div style={{ width: `${Math.min(100, percentage)}%`, background: budget.chartColor }} /></div>
                      <div className="budget-foot"><span>{money(budget.spent)} spent</span><span>of {money(budget.limit)}</span></div>
                    </div>
                  );
                })}
              </div>
              <button className="budget-link" onClick={() => setActivePage("Budgets")}>Manage budgets <ChevronRight size={15} /></button>
            </article>
          </section>

          <section className="bottom-banner">
            <div className="banner-leaf"><Sprout size={25} /></div>
            <div><strong>A little progress is still progress.</strong><p>Keep making mindful money decisions. Your future self will thank you.</p></div>
            <button onClick={() => setShowAI(true)}>Get an insight <Sparkles size={15} /></button>
          </section>

          <footer className="app-footer"><span>© 2026 Sprout. Growing better money habits.</span><span>Made with <span className="footer-heart">♥</span> for your financial growth.</span></footer>
        </div>
      </main>

      <button className={`fox-fab ${showAI ? "fox-fab-active" : ""}`} onClick={() => setShowAI(!showAI)} aria-label="Open Sprout AI">
        <span className="fox-face">🦊</span><span className="fox-online" />
      </button>

      {showAI && (
        <aside className="ai-panel">
          <div className="ai-header">
            <div className="ai-avatar">🦊</div>
            <div><strong>Sprout AI</strong><span><i /> Your money companion</span></div>
            <button className="icon-button" onClick={() => setShowAI(false)}><X size={19} /></button>
          </div>
          <div className="ai-welcome"><span className="ai-sparkle"><Sparkles size={17} /></span><strong>Hey, happy to see you!</strong><p>I'm here to help you understand your money, build better habits and grow your savings.</p></div>
          <div className="chat-messages">
            {messages.map((message, index) => <div className={`chat-message ${message.role}`} key={index}>{message.text}</div>)}
          </div>
          <div className="suggestion-chips">
            <button onClick={() => setChatInput("How am I spending this month?")}>My spending</button>
            <button onClick={() => setChatInput("How can I save more?")}>Saving tips</button>
          </div>
          <form className="chat-input" onSubmit={sendMessage}>
            <input value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="Ask your little fox..." />
            <button type="submit"><Send size={17} /></button>
          </form>
          <span className="ai-disclaimer">Sprout AI · Your friendly financial companion</span>
        </aside>
      )}

      {showModal && (
        <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}>
          <form className="transaction-modal" onSubmit={addTransaction}>
            <div className="modal-heading"><div><span className="modal-eyebrow">YOUR MONEY JOURNAL</span><h2>Add a transaction</h2><p>Every little detail helps your finances grow.</p></div><button type="button" className="icon-button" onClick={() => setShowModal(false)}><X size={20} /></button></div>
            <div className="type-toggle">
              <button type="button" className={form.type === "expense" ? "expense-selected" : ""} onClick={() => setForm({ ...form, type: "expense" })}><ArrowUpRight size={16} /> Expense</button>
              <button type="button" className={form.type === "income" ? "income-selected" : ""} onClick={() => setForm({ ...form, type: "income" })}><ArrowDownRight size={16} /> Income</button>
            </div>
            <label className="form-label">Description<input autoFocus required placeholder="What was it for?" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
            <label className="form-label">Amount (₹)<input required type="number" min="1" step="0.01" placeholder="0.00" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></label>
            <label className="form-label">Category<select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}><option value="">Uncategorized</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
            <div className="modal-actions"><button type="button" className="cancel-button" onClick={() => setShowModal(false)}>Cancel</button><button type="submit" className="primary-button" disabled={savingTransaction}><Check size={16} /> {savingTransaction ? "Saving…" : "Save transaction"}</button></div>
          </form>
        </div>
      )}
    </div>
  );
}

export default App;
