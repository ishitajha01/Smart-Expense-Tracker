import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts";
import {
  AlertTriangle, ArrowDownRight, ArrowLeftRight, ArrowUpRight, Bell, CalendarDays, ChartNoAxesCombined,
  ChevronRight, CircleHelp, LayoutDashboard, LogOut, Menu, Plus, Search, Send,
  Settings, Sparkles, Sprout, Tags, Target, Trash2, Wallet, X, Mic,
} from "lucide-react";
import { getDashboardSummary } from "./api/dashboard";
import {
  createBudget, createCategory, createTransaction, deleteBudget, deleteCategory,
  deleteTransaction, getBudgets, getCategories, getTransactions, updateBudget,
  updateCategory, updateTransaction,
} from "./api/finance";
import { useAuth } from "./context/useAuth";
import { createAssistantConversation, getAssistantConversation, getAssistantConversations, sendAssistantMessage } from "./api/assistant";
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
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [selectedMonth, setSelectedMonth] = useState(() => monthValue(today));
  const [alertThreshold, setAlertThreshold] = useState(() => {
    const saved = Number(localStorage.getItem(`sprout_alert_threshold_${localStorage.getItem("username") || "user"}`));
    return [60, 70, 80, 90].includes(saved) ? saved : 80;
  });
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => localStorage.getItem(`sprout_notifications_${localStorage.getItem("username") || "user"}`) !== "false");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [budgetAttentionOnly, setBudgetAttentionOnly] = useState(false);
  const alertPreferenceKey = `sprout_alert_threshold_${localStorage.getItem("username") || "user"}`;
  const notificationPreferenceKey = `sprout_notifications_${localStorage.getItem("username") || "user"}`;
  const [mobileNav, setMobileNav] = useState(false);
  const [modal, setModal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [conversationId, setConversationId] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState("");
  const [listening, setListening] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const voiceSupported = typeof window !== "undefined" && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
  const [voiceError, setVoiceError] = useState("");
  const speechRecognition = useRef(null);
  const [captureText, setCaptureText] = useState("");

  const refresh = useCallback(async () => {
    const year = Number(selectedMonth.slice(0, 4));
    const month = Number(selectedMonth.slice(5));
    const [summaryData, transactionData, budgetData, categoryData] = await Promise.all([
      getDashboardSummary(month, year), getTransactions(),
      getBudgets(month, year), getCategories(),
    ]);
    setSummary(summaryData);
    setTransactions(responseList(transactionData));
    setBudgets(responseList(budgetData));
    setCategories(responseList(categoryData));
  }, [selectedMonth]);

  useEffect(() => {
    let current = true;
    const [year, month] = selectedMonth.split("-").map(Number);
    Promise.all([getDashboardSummary(month, year), getTransactions(), getBudgets(month, year), getCategories()]).then(([summaryData, transactionData, budgetData, categoryData]) => {
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

  useEffect(() => {
    if (!notificationsOpen) return undefined;
    const closeOnEscape = (event) => { if (event.key === "Escape") setNotificationsOpen(false); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [notificationsOpen]);

  useEffect(() => {
    return () => speechRecognition.current?.abort();
  }, []);

  useEffect(() => {
    if (!listening) return undefined;
    const timer = window.setInterval(() => setRecordingSeconds((seconds) => seconds + 1), 1000);
    return () => window.clearInterval(timer);
  }, [listening]);

  useEffect(() => {
    if (activePage !== "AI Assistant") return;
    let current = true;
    getAssistantConversations().then(async (items) => {
      if (current) setConversations(items);
      if (!current || !items.length) return;
      const latest = await getAssistantConversation(items[0].id);
      if (!current) return;
      setConversationId(latest.id);
      setMessages(latest.messages || []);
    }).catch(() => { /* A new conversation remains available if history cannot load. */ });
    return () => { current = false; };
  }, [activePage]);

  const categoriesById = useMemo(() => new Map(categories.map((category) => [category.id, category.name])), [categories]);
  const filteredTransactions = useMemo(() => transactions.filter((item) => {
    const category = categoriesById.get(item.category) || "Uncategorized";
    const queryMatch = `${item.description} ${category}`.toLowerCase().includes(search.trim().toLowerCase());
    const categoryMatch = categoryFilter === "all" || String(item.category || "") === categoryFilter;
    return queryMatch && categoryMatch && (filter === "all" || item.type === filter);
  }), [transactions, categoriesById, search, filter, categoryFilter]);

  const selectedTransactions = useMemo(() => transactions.filter((item) => item.transaction_date.startsWith(selectedMonth)), [transactions, selectedMonth]);
  const dashboardTransactions = useMemo(() => selectedTransactions.filter((item) => {
    const category = categoriesById.get(item.category) || "Uncategorized";
    return `${item.description} ${category}`.toLowerCase().includes(search.trim().toLowerCase()) && (filter === "all" || item.type === filter);
  }), [selectedTransactions, categoriesById, search, filter]);

  const dailyData = useMemo(() => {
    const totals = new Map();
    selectedTransactions.forEach((item) => {
      const day = Number(item.transaction_date.slice(8, 10));
      const values = totals.get(day) || { day, income: 0, expenses: 0 };
      values[item.type === "income" ? "income" : "expenses"] += Number(item.amount);
      totals.set(day, values);
    });
    return [...totals.values()].sort((a, b) => a.day - b.day);
  }, [selectedTransactions]);

  const spendingData = useMemo(() => {
    const totals = new Map();
    selectedTransactions.filter((item) => item.type === "expense").forEach((item) => {
      const name = categoriesById.get(item.category) || "Uncategorized";
      totals.set(name, (totals.get(name) || 0) + Number(item.amount));
    });
    return [...totals.entries()].map(([name, value], index) => ({ name, value, color: palette[index % palette.length] }));
  }, [selectedTransactions, categoriesById]);
  const topSpendingCategory = spendingData.slice().sort((a, b) => b.value - a.value)[0];

  const money = useCallback((value) => new Intl.NumberFormat("en-IN", {
    style: "currency", currency: "INR", maximumFractionDigits: 0,
  }).format(Number(value || 0)), []);
  const totalMonthlyBudget = budgets.reduce((total, budget) => total + Number(budget.amount), 0);
  const budgetUtilization = totalMonthlyBudget > 0 ? Number(summary?.total_expenses || 0) / totalMonthlyBudget * 100 : 0;
  const budgetOverspent = budgets.reduce((total, budget) => total + Math.max(0, -Number(budget.remaining || 0)), 0);
  const budgetRemaining = budgets.reduce((total, budget) => total + Math.max(0, Number(budget.remaining || 0)), 0);
  const financialTone = (percentage) => percentage >= 100 ? "danger" : percentage >= alertThreshold ? "warning" : "healthy";
  const hasOverspentCategory = budgets.some((budget) => Number(budget.remaining) < 0);
  const attentionBudgets = budgets.filter((budget) => Number(budget.amount) > 0 && Number(budget.spent) / Number(budget.amount) * 100 >= alertThreshold);
  const hasNearLimitCategory = attentionBudgets.length > 0;
  const remainingTone = hasOverspentCategory ? "danger" : hasNearLimitCategory ? "warning" : financialTone(budgetUtilization);
  const budgetedCategoryIds = new Set(budgets.map((budget) => Number(budget.category)));
  const unbudgetedExpenses = selectedTransactions.filter((item) => item.type === "expense" && !budgetedCategoryIds.has(Number(item.category))).reduce((total, item) => total + Number(item.amount), 0);
  const budgetBreakdown = budgets.filter((budget) => Number(budget.remaining) < 0).map((budget) => ({ ...budget, overspent: Math.abs(Number(budget.remaining)) }));
  const pageBudgets = budgetAttentionOnly ? attentionBudgets : budgets;
  const transactionDefaultDate = selectedMonth === monthValue(today) ? dateValue(today) : `${selectedMonth}-01`;

  const openTransaction = (item = null) => setModal({ kind: "transaction", item });
  const openBudget = (item = null) => setModal({ kind: "budget", item });
  const showBudgetTransactions = (budget) => {
    setCategoryFilter(String(budget.category));
    setFilter("expense");
    setSearch("");
    setActivePage("Transactions");
    setNotificationsOpen(false);
  };
  const openBudgetAttention = () => {
    setBudgetAttentionOnly(true);
    setActivePage("Budgets");
    setNotificationsOpen(false);
  };
  const openBudgetSummary = () => {
    setBudgetAttentionOnly(attentionBudgets.length > 0);
    setActivePage("Budgets");
  };
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
    if (modal.kind === "transaction" || modal.kind === "candidate") {
      const body = { description: data.description.trim(), amount: data.amount, type: data.type, category: data.category ? Number(data.category) : null, transaction_date: data.transaction_date };
      runAction(() => modal.kind === "candidate" ? createTransaction(body) : modal.item ? updateTransaction(modal.item.id, body) : createTransaction(body));
    } else if (modal.kind === "budget") {
      runAction(async () => {
        const categoryName = data.category_name.trim();
        let category = categories.find((item) => item.name.toLowerCase() === categoryName.toLowerCase());
        if (!category) category = await createCategory({ name: categoryName });
        const body = { category: category.id, amount: data.amount, month: Number(data.month.slice(5)), year: Number(data.month.slice(0, 4)) };
        return modal.item ? updateBudget(modal.item.id, body) : createBudget(body);
      });
    } else if (modal.kind === "category") {
      const body = { name: data.name.trim() };
      runAction(() => modal.item ? updateCategory(modal.item.id, body) : createCategory(body));
    }
  };

  const extractCandidate = (event) => {
    event.preventDefault();
    const text = captureText.trim();
    if (!text) return;
    const explicitIsoDate = text.match(/\b\d{4}-\d{2}-\d{2}\b/)?.[0];
    const dateText = text.toLowerCase();
    let transactionDate = transactionDefaultDate;
    if (explicitIsoDate) transactionDate = explicitIsoDate;
    else if (dateText.includes("today")) transactionDate = dateValue(today);
    else if (dateText.includes("yesterday")) {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      transactionDate = dateValue(yesterday);
    }
    const amountText = text.replace(/\b\d{4}-\d{2}-\d{2}\b/g, " ").match(/\b\d[\d,]*(?:\.\d{1,2})?\b/)?.[0] || "";
    const category = categories.slice().sort((a, b) => b.name.length - a.name.length).find((item) => dateText.includes(item.name.toLowerCase()));
    const incomeWords = /\b(salary|income|earned|received|paycheck|deposit)\b/i;
    setModal({
      kind: "candidate",
      item: {
        description: text,
        amount: amountText.replaceAll(",", ""),
        type: incomeWords.test(text) ? "income" : "expense",
        category: category?.id || "",
        transaction_date: transactionDate,
      },
    });
  };

  const removeRecord = (label, action) => {
    const detail = label === "category" ? " Transactions will become uncategorized and budgets using it will be removed." : " This cannot be undone.";
    if (window.confirm(`Delete this ${label}?${detail}`)) runAction(action);
  };

  const sendMessage = async (event) => {
    event.preventDefault();
    const question = chatInput.trim();
    if (!question || chatLoading) return;
    setChatInput("");
    setChatError("");
    setChatLoading(true);
    setMessages((previous) => [...previous, { role: "user", content: question, pending: true }]);
    try {
      const response = await sendAssistantMessage(question, conversationId, Number(selectedMonth.slice(5)), Number(selectedMonth.slice(0, 4)));
      setConversationId(response.conversation_id);
      setMessages((previous) => [...previous.filter((message) => !message.pending), response.user_message, response.message]);
      getAssistantConversations().then(setConversations).catch(() => {});
    } catch (cause) {
      setMessages((previous) => previous.filter((message) => !message.pending));
      setChatInput(question);
      const detail = cause.response?.data?.detail;
      const statusMessage = cause.response?.status
        ? `The backend returned HTTP ${cause.response.status}${detail ? `: ${detail}` : ". Check the Django terminal for the error details."}`
        : "The browser couldn't reach the backend. Check that Django is running and that this page is opened from localhost:5173 or 127.0.0.1:5173.";
      console.error("Sprout AI request failed", { status: cause.response?.status, detail, code: cause.code });
      setChatError(detail || statusMessage);
    } finally {
      setChatLoading(false);
    }
  };

  const startNewConversation = async () => {
    try {
      const conversation = await createAssistantConversation();
      setConversationId(conversation.id);
      setMessages([]);
      setConversations((previous) => [conversation, ...previous]);
      setChatError("");
    } catch (cause) {
      setChatError(cause.response?.data?.detail || "Couldn't start a new conversation.");
    }
  };

  const openConversation = async (id) => {
    if (!id) return;
    try {
      const conversation = await getAssistantConversation(id);
      setConversationId(conversation.id);
      setMessages(conversation.messages || []);
      setChatError("");
    } catch (cause) {
      setChatError(cause.response?.data?.detail || "Couldn't load that conversation.");
    }
  };

  const toggleVoice = () => {
    const Recognition = typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);
    if (!Recognition) return;
    setVoiceError("");
    if (listening) { speechRecognition.current?.stop(); setListening(false); return; }
    const recognition = new Recognition();
    recognition.lang = "en-IN";
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.onresult = (event) => {
      setChatInput(Array.from(event.results).map((result) => result[0].transcript).join(""));
      setVoiceError("");
    };
    recognition.onerror = (event) => {
      setListening(false);
      setVoiceError(event.error === "not-allowed" ? "Allow microphone access in your browser to use voice input." : "Voice capture didn’t work. You can type your message or try again.");
    };
    recognition.onend = () => setListening(false);
    speechRecognition.current = recognition;
    try { setRecordingSeconds(0); recognition.start(); setListening(true); }
    catch { setVoiceError("Voice capture is already active. Stop it before starting again."); }
  };

  const cancelVoice = () => {
    speechRecognition.current?.abort();
    setListening(false);
    setChatInput("");
    setVoiceError("");
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
        <nav className="main-nav">{navigation.map(({ label, icon: Icon }) => <button key={label} className={`nav-item ${activePage === label ? "active" : ""}`} onClick={() => { setActivePage(label); setMobileNav(false); if (label === "Budgets") setBudgetAttentionOnly(false); }}><Icon size={18} /><span>{label}</span>{label === "Transactions" && <span className="nav-count">{transactions.length}</span>}</button>)}</nav>
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
            <div className="notification-wrap"><button className="notification-button icon-button" type="button" aria-label={`Budget alerts${notificationsEnabled && attentionBudgets.length ? `, ${attentionBudgets.length} active` : ""}`} aria-expanded={notificationsOpen} onClick={() => setNotificationsOpen((open) => !open)}><Bell size={18} />{notificationsEnabled && attentionBudgets.length > 0 && <span className="notification-count">{attentionBudgets.length}</span>}</button>{notificationsOpen && <div className="notifications-popover"><div className="notifications-heading"><strong>Budget alerts</strong><span>{notificationsEnabled ? attentionBudgets.length : "Off"}</span></div>{!notificationsEnabled ? <p className="notification-empty">In-app budget alerts are turned off. You can enable them in Settings.</p> : attentionBudgets.length ? attentionBudgets.map((budget) => <button className={`notification-item ${Number(budget.remaining) < 0 ? "over" : "near"}`} key={budget.id} onClick={() => showBudgetTransactions(budget)}><AlertTriangle size={15} /><span><strong>{budget.category_name}</strong><small>{Number(budget.remaining) < 0 ? `Over by ${money(Math.abs(Number(budget.remaining)))}` : `${Math.round(Number(budget.spent) / Number(budget.amount) * 100)}% used`}</small></span><ChevronRight size={14} /></button>) : <p className="notification-empty">No categories have reached your alert threshold this month.</p>}<button className="notification-footer" onClick={openBudgetAttention}>Review budget alerts</button></div>}</div>
            <button className="topbar-logout" type="button" onClick={logout}><LogOut size={16} /><span>Log out</span></button>
          </div>
        </header>

        <div className="dashboard-content">
          <div className="welcome-row"><div><div className="eyebrow"><span className="eyebrow-dot" /> YOUR MONEY, YOUR GROWTH</div><h1>{pageTitle}</h1><p className="welcome-subtitle">{activePage === "Overview" ? "A live view of your recorded income, expenses, and budgets." : `Manage your ${activePage.toLowerCase()} using your saved finance data.`}</p></div>
            <div className="welcome-actions">{["Overview", "Budgets", "Analytics", "Transactions"].includes(activePage) && <label className="period-select"><CalendarDays size={16} /><input aria-label="Dashboard month" type="month" value={selectedMonth} onChange={(event) => { if (event.target.value) { setLoading(true); setSelectedMonth(event.target.value); } }} /></label>}
              {!["Settings", "AI Assistant", "Help"].includes(activePage) && <button className="primary-button" onClick={() => activePage === "Budgets" ? openBudget() : activePage === "Categories" ? setModal({ kind: "category", item: null }) : openTransaction()}><Plus size={17} /> Add {activePage === "Budgets" ? "budget" : activePage === "Categories" ? "category" : "transaction"}</button>}
            </div>
          </div>
          {error && <div className="page-notice" role="alert">{error}<button onClick={() => refresh().then(() => setError("")).catch(() => {})}>Retry</button></div>}
          {loading ? <div className="panel loading-state">Loading your finance data…</div> : <>
            {activePage === "Overview" && <>
              <section className="summary-grid">
                <article className={`summary-card balance-card ${Number(summary?.balance || 0) < 0 ? "metric-danger" : "metric-healthy"}`}><div className="card-topline"><span>Total balance</span><div className="metric-icon"><Wallet size={18} /></div></div><div className="metric-value">{money(summary?.balance)}</div><div className="metric-bottom">For {monthNames[Number(selectedMonth.slice(5)) - 1]} {selectedMonth.slice(0, 4)}</div></article>
                <article className={`summary-card expense-card ${budgetUtilization >= 100 ? "metric-danger" : budgetUtilization >= alertThreshold ? "metric-warning" : ""}`}><div className="card-topline"><span>Total expenses</span><div className="metric-icon"><ArrowUpRight size={18} /></div></div><div className="metric-value">{money(summary?.total_expenses)}</div><div className="utilization-meta"><span>{totalMonthlyBudget ? `${Math.round(budgetUtilization)}% of budget used` : "No monthly budget set"}</span>{totalMonthlyBudget > 0 && <div className={`utilization-track ${financialTone(budgetUtilization)}`}><span style={{ width: `${Math.min(100, budgetUtilization)}%` }} /></div>}<span className="utilization-note">{unbudgetedExpenses > 0 ? totalMonthlyBudget ? `${money(unbudgetedExpenses)} in categories without budgets is included in this utilization.` : `${money(unbudgetedExpenses)} in expenses has no budget to compare against.` : totalMonthlyBudget ? "All monthly expenses are included in this utilization figure." : "Set a budget to calculate monthly utilization."}</span></div></article>
                <article className="summary-card income-card metric-healthy"><div className="card-topline"><span>Total income</span><div className="metric-icon"><ArrowDownRight size={18} /></div></div><div className="metric-value">{money(summary?.total_income)}</div><div className="metric-bottom">For selected month</div></article>
                <button type="button" className={`summary-card savings-card metric-card-button ${budgets.length ? remainingTone : "metric-neutral"}`} aria-label={`${hasOverspentCategory ? "Budget overspent" : "Budget remaining"}: ${money(hasOverspentCategory ? budgetOverspent : budgetRemaining)}. Open budgets`} onClick={openBudgetSummary}><div className="card-topline"><span>{hasOverspentCategory ? "Budget overspent" : "Budget remaining"}</span><div className="metric-icon"><Target size={18} /></div></div><div className="metric-value">{money(hasOverspentCategory ? budgetOverspent : budgetRemaining)}</div><div className="metric-bottom"><span>{budgets.length ? `${budgets.length} budgets · ${monthNames[Number(selectedMonth.slice(5)) - 1]}` : "Create a budget to track remaining funds"}</span>{attentionBudgets.length > 0 && <span className="alert-drilldown">Review {attentionBudgets.length} categories</span>}</div></button>
              </section>
              {budgetBreakdown.length > 0 && <section className="budget-alert-panel" aria-labelledby="budget-alert-title"><div className="budget-alert-title"><AlertTriangle size={17} /><strong id="budget-alert-title">Over budget by category</strong><span>{budgetBreakdown.length} {budgetBreakdown.length === 1 ? "category" : "categories"}</span></div><div className="budget-alert-list">{budgetBreakdown.map((budget) => <div className="budget-alert-row" key={budget.id}><div><strong>{budget.category_name}</strong><span>{money(budget.spent)} spent of {money(budget.amount)}</span></div><strong className="overspent-amount">Over by {money(budget.overspent)}</strong><button className="row-action danger-action" onClick={() => showBudgetTransactions(budget)}>View expenses</button></div>)}</div></section>}
              <section className="main-grid">
                <article className="panel chart-panel"><SectionTitle title="Income vs. expenses" subtitle={`Daily totals · ${monthNames[Number(selectedMonth.slice(5)) - 1]} ${selectedMonth.slice(0, 4)}`} /><div className="chart-legend"><span><i className="legend-dot income-dot" /> Income</span><span><i className="legend-dot expense-dot" /> Expenses</span></div>{dailyData.length ? <FinanceChart data={dailyData} money={money} /> : <EmptyState text="No transactions in this month." />}</article>
                <article className="panel spending-panel"><SectionTitle title="Where it goes" subtitle="Expenses by category this month" /><SpendingChart data={spendingData} money={money} /><div className="category-legend">{spendingData.map((item) => <div className="category-row" key={item.name}><span className="category-name"><i style={{ background: item.color }} />{item.name}</span><strong>{money(item.value)}</strong></div>)}{!spendingData.length && <EmptyState text="No expenses recorded in this month." />}</div></article>
              </section>
              <section className="bottom-grid">
                <article className="panel transactions-panel"><SectionTitle title="Recent transactions" subtitle={`Saved activity · ${monthNames[Number(selectedMonth.slice(5)) - 1]} ${selectedMonth.slice(0, 4)}`} action={<button className="text-action" onClick={() => setActivePage("Transactions")}>View all <ChevronRight size={15} /></button>} /><div className="transaction-toolbar"><FilterTabs filter={filter} setFilter={setFilter} /></div><div className="transaction-list">{transactionRows(dashboardTransactions.slice(0, 6))}{!dashboardTransactions.length && <EmptyState text="No transactions in this month." />}</div></article>
                <article className="panel budget-panel"><SectionTitle title="Budgets" subtitle={`For ${monthNames[Number(selectedMonth.slice(5)) - 1]} ${selectedMonth.slice(0, 4)}`} action={<button className="text-action" onClick={() => setActivePage("Budgets")}>Manage <ChevronRight size={15} /></button>} /><BudgetList budgets={budgets} money={money} alertThreshold={alertThreshold} onEdit={openBudget} onDelete={(item) => removeRecord("budget", () => deleteBudget(item.id))} onViewTransactions={showBudgetTransactions} /><button className="budget-link" onClick={() => openBudget()}>Create budget <Plus size={15} /></button></article>
              </section>
              <section className="bottom-banner"><div className="banner-leaf"><Sprout size={25} /></div><div><strong>{topSpendingCategory ? `${topSpendingCategory.name} is your largest spending category` : "No spending insights for this month yet"}</strong><p>{topSpendingCategory ? `${money(topSpendingCategory.value)} in recorded expenses during ${monthNames[Number(selectedMonth.slice(5)) - 1]}.` : "Add expenses to see a category breakdown and monthly insights."}</p></div><button onClick={() => setActivePage("Analytics")}>View analytics <ChevronRight size={15} /></button></section>
            </>}
            {activePage === "Transactions" && <section className="panel management-panel"><div className="transaction-toolbar"><FilterTabs filter={filter} setFilter={setFilter} /><select className="category-filter" aria-label="Filter by category" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}><option value="all">All categories</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><span>{filteredTransactions.filter((item) => item.transaction_date.startsWith(selectedMonth)).length} transactions · selected month</span></div><div className="transaction-list">{transactionRows(filteredTransactions.filter((item) => item.transaction_date.startsWith(selectedMonth)))}{!filteredTransactions.some((item) => item.transaction_date.startsWith(selectedMonth)) && <EmptyState text={search ? "No matching transactions in this month." : "No transactions in this month."} />}</div></section>}
            {activePage === "Categories" && <section className="panel management-panel"><SectionTitle title="Your categories" subtitle="Default categories are shared. Your categories can be renamed or removed." /><div className="management-list">{categories.map((item) => <div className="management-row" key={item.id}><span className="category-swatch" style={{ background: palette[item.id % palette.length] }} /><strong>{item.name}</strong><span>{item.owner ? "Custom" : "Default"}</span>{item.owner && <><button className="row-action" onClick={() => setModal({ kind: "category", item })}>Rename</button><button className="row-action danger-action" aria-label={`Delete ${item.name}`} onClick={() => removeRecord("category", () => deleteCategory(item.id))}><Trash2 size={16} /></button></>}</div>)}{!categories.length && <EmptyState text="No categories available yet." />}</div></section>}
            {activePage === "Budgets" && <section className="panel management-panel"><SectionTitle title="Monthly budgets" subtitle={budgetAttentionOnly ? "Showing categories at or above your alert threshold." : "Set a spending limit for each category."} action={budgetAttentionOnly && <button className="text-action" onClick={() => setBudgetAttentionOnly(false)}>Show all budgets</button>} /><BudgetList budgets={pageBudgets} money={money} alertThreshold={alertThreshold} onEdit={openBudget} onDelete={(item) => removeRecord("budget", () => deleteBudget(item.id))} onViewTransactions={showBudgetTransactions} showActions /><button className="primary-button" onClick={() => openBudget()}><Plus size={17} /> Create budget</button></section>}
            {activePage === "Analytics" && <section className="main-grid"><article className="panel chart-panel"><SectionTitle title="Income vs. expenses" subtitle={`Daily totals · ${monthNames[Number(selectedMonth.slice(5)) - 1]} ${selectedMonth.slice(0, 4)}`} />{dailyData.length ? <FinanceChart data={dailyData} money={money} /> : <EmptyState text="No transactions in this month." />}</article><article className="panel spending-panel"><SectionTitle title="Expense categories" subtitle="Selected month" /><SpendingChart data={spendingData} money={money} /><div className="category-legend">{spendingData.map((item) => <div className="category-row" key={item.name}><span className="category-name"><i style={{ background: item.color }} />{item.name}</span><strong>{money(item.value)}</strong></div>)}{!spendingData.length && <EmptyState text="No expenses recorded in this month." />}</div></article></section>}
            {activePage === "Settings" && <section className="panel management-panel"><SectionTitle title="Account and alerts" subtitle="Adjust how Sprout flags approaching budget limits." /><div className="setting-control"><strong>Signed in as</strong><span>{localStorage.getItem("username") || "Your account"}</span></div><div className="setting-control"><strong>Display currency</strong><span>Indian Rupee (INR)</span></div><label className="alert-preference"><span><strong>Approaching-budget warning</strong><small>Show amber warnings starting at this percentage.</small></span><select value={alertThreshold} onChange={(event) => { const value = Number(event.target.value); setAlertThreshold(value); localStorage.setItem(alertPreferenceKey, String(value)); }}><option value="60">60%</option><option value="70">70%</option><option value="80">80%</option><option value="90">90%</option></select></label><label className="alert-preference"><span><strong>In-app budget notifications</strong><small>Show near-limit and overspending alerts in the top bar.</small></span><input type="checkbox" checked={notificationsEnabled} onChange={(event) => { setNotificationsEnabled(event.target.checked); localStorage.setItem(notificationPreferenceKey, String(event.target.checked)); }} /></label><button className="logout-button setting-logout" onClick={logout}><LogOut size={17} /> Log out</button></section>}
            {activePage === "Help" && <section className="panel management-panel"><SectionTitle title="Help & support" subtitle="How to use your Sprout finance tracker." /><div className="help-content"><h3>Record an expense or income</h3><p>Use Add transaction to save a description, amount, date, and optional category. Your totals and charts update from saved records.</p><h3>Set a budget</h3><p>Open Budgets, choose a category and month, and enter a spending limit. Sprout calculates spending from matching expense transactions.</p><h3>Manage your data</h3><p>Use the Transactions and Categories pages to edit or delete your own records. Default categories are shared and cannot be renamed or deleted.</p><h3>Sign out</h3><p>Use Log out in the sidebar or top bar to clear this browser's sign-in session.</p></div></section>}
            {activePage === "AI Assistant" && <section className="panel assistant-page"><SectionTitle title="Money assistant" subtitle="Sprout AI answers with figures from your saved account data." action={<div className="assistant-actions"><select aria-label="Conversation history" value={conversationId || ""} onChange={(event) => openConversation(Number(event.target.value))}><option value="">Conversation history</option>{conversations.map((conversation) => <option key={conversation.id} value={conversation.id}>{conversation.title}</option>)}</select><button className="text-action" onClick={startNewConversation}>New conversation</button></div>} /><form className="capture-form" onSubmit={extractCandidate}><label className="form-label">Quick transaction capture<input value={captureText} onChange={(event) => setCaptureText(event.target.value)} placeholder="e.g. Spent 450 on Food today" /></label><button className="primary-button" type="submit">Review details</button><span>Review the details before saving</span></form><div className="chat-messages" aria-live="polite">{messages.length ? messages.map((message) => <div className={`chat-message ${message.role}`} key={message.id || `${message.role}-${message.content}`}><span>{message.content}</span></div>) : <div className="empty-state">Ask about your recorded spending, savings, or budgets.</div>}{chatLoading && <div className="chat-message assistant">Sprout is thinking…</div>}</div><div className="suggestion-chips"><button type="button" onClick={() => setChatInput("Analyse my spending this month.")}>My spending</button><button type="button" onClick={() => setChatInput("How can I save more?")}>Savings</button><button type="button" onClick={() => setChatInput("How are my budgets? ")}>Budgets</button></div>{voiceError && <p className="form-error" role="alert">{voiceError}</p>}{!voiceSupported && <p className="form-hint">Voice input isn’t supported in this browser. You can type your message instead.</p>}{chatError && <p className="form-error" role="alert">{chatError}</p>}<form className="chat-input" onSubmit={sendMessage}><input value={chatInput} onChange={(event) => setChatInput(event.target.value)} placeholder={listening ? `Listening · ${String(Math.floor(recordingSeconds / 60)).padStart(2, "0")}:${String(recordingSeconds % 60).padStart(2, "0")} · edit before sending` : "Ask about your money…"} aria-label="Message Sprout AI" />{listening && <button type="button" onClick={cancelVoice} aria-label="Cancel recording"><X size={16} /></button>}<button type="button" className={listening ? "recording" : ""} onClick={toggleVoice} aria-label={listening ? "Stop voice recording" : "Start voice recording"} disabled={!voiceSupported}><Mic size={17} /></button><button type="submit" aria-label="Send message" disabled={chatLoading || !chatInput.trim()}><Send size={17} /></button></form></section>}
          </>}
          <footer className="app-footer"><span>© {today.getFullYear()} Sprout</span><span>Your financial data, clearly presented.</span></footer>
        </div>
      </main>

      {activePage !== "AI Assistant" && <button className="fox-fab" onClick={() => setActivePage("AI Assistant")} aria-label="Open money assistant"><span className="fox-face">🌱</span></button>}
      {modal && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setModal(null); }}><form className="transaction-modal" onSubmit={submitModal}>
        <div className="modal-heading"><div><span className="modal-eyebrow">SPROUT</span><h2>{modal.kind === "candidate" ? "Review transaction" : modal.kind === "transaction" ? modal.item ? "Edit transaction" : "Add transaction" : modal.kind === "budget" ? modal.item ? "Edit budget" : "Create budget" : modal.item ? "Rename category" : "Add category"}</h2><p>{modal.kind === "candidate" ? "Review or correct these suggestions. Nothing is saved until you confirm." : "Your changes are saved to your account."}</p></div><button type="button" className="icon-button" aria-label="Close dialog" disabled={saving} onClick={() => setModal(null)}><X size={20} /></button></div>
        {error && <p className="form-error" role="alert">{error}</p>}
        {(modal.kind === "transaction" || modal.kind === "candidate") && <><div className="type-toggle"><label><input type="radio" name="type" value="expense" defaultChecked={modal.item?.type !== "income"} /> Expense</label><label><input type="radio" name="type" value="income" defaultChecked={modal.item?.type === "income"} /> Income</label></div><label className="form-label">Description<input name="description" required maxLength="240" defaultValue={modal.item?.description || ""} /></label><label className="form-label">Amount<input name="amount" required type="number" min="0.01" step="0.01" defaultValue={modal.item?.amount || ""} /></label><label className="form-label">Date<input name="transaction_date" required type="date" defaultValue={modal.item?.transaction_date || transactionDefaultDate} /></label><label className="form-label">Category<select name="category" defaultValue={modal.item?.category || ""}><option value="">Uncategorized</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label></>}
        {modal.kind === "budget" && <><label className="form-label">Category<input name="category_name" required list="budget-categories" maxLength="60" placeholder="Type a category or choose a suggestion" defaultValue={modal.item?.category_name || ""} /><datalist id="budget-categories">{categories.map((item) => <option key={item.id} value={item.name} />)}</datalist><span className="form-hint">You can use an existing category or type a new one.</span></label><label className="form-label">Monthly limit<input name="amount" required type="number" min="0.01" step="0.01" defaultValue={modal.item?.amount || ""} /></label><label className="form-label">Month<input name="month" required type="month" defaultValue={modal.item ? `${modal.item.year}-${String(modal.item.month).padStart(2, "0")}` : selectedMonth} /></label></>}
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
  return <div className="main-chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={data} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}><defs><linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#8CCF9F" stopOpacity={0.23} /><stop offset="100%" stopColor="#8CCF9F" stopOpacity={0} /></linearGradient><linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#A78BFA" stopOpacity={0.2} /><stop offset="100%" stopColor="#A78BFA" stopOpacity={0} /></linearGradient></defs><CartesianGrid stroke="#29263D" strokeDasharray="3 5" vertical={false} /><XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "#85839B", fontSize: 11 }} dy={10} /><YAxis axisLine={false} tickLine={false} tick={{ fill: "#85839B", fontSize: 10 }} tickFormatter={(value) => `${value / 1000}k`} /><Tooltip contentStyle={{ background: "#211D36", border: "1px solid #3A3455", borderRadius: 12, color: "#fff", fontSize: 12 }} labelFormatter={(day) => `Day ${day}`} formatter={(value) => money(value)} /><Area type="monotone" dataKey="income" stroke="#8CCF9F" strokeWidth={2.5} fill="url(#incomeGradient)" /><Area type="monotone" dataKey="expenses" stroke="#A78BFA" strokeWidth={2.5} fill="url(#expenseGradient)" /></AreaChart></ResponsiveContainer></div>;
}

function SpendingChart({ data, money }) {
  return <div className="donut-wrap"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={data} dataKey="value" nameKey="name" innerRadius="67%" outerRadius="88%" paddingAngle={4} stroke="none">{data.map((entry) => <Cell key={entry.name} fill={entry.color} />)}</Pie><Tooltip formatter={(value) => money(value)} /></PieChart></ResponsiveContainer><div className="donut-center"><strong>{money(data.reduce((sum, item) => sum + item.value, 0))}</strong><span>Total spent</span></div></div>;
}

function BudgetList({ budgets, money, onEdit, onDelete, onViewTransactions, alertThreshold = 80, showActions = false }) {
  return <div className="budget-list">{budgets.map((budget, index) => {
    const limit = Number(budget.amount);
    const spent = Number(budget.spent);
    const percentage = limit > 0 ? spent / limit * 100 : 0;
    const status = percentage >= 100 ? "over" : percentage >= alertThreshold ? "near" : "healthy";
    const remaining = limit - spent;
    return <div className={`budget-item budget-${status}`} key={budget.id}><div className="budget-heading"><div className="budget-name"><span className="budget-icon" style={{ color: palette[index % palette.length] }}><Target size={16} /></span><strong>{budget.category_name}</strong></div><span>{Math.round(percentage)}%</span></div><div className="progress-track"><div style={{ width: `${Math.min(100, percentage)}%` }} /></div><div className="budget-foot"><span>{money(spent)} spent</span><span>of {money(limit)}</span></div>{status !== "healthy" && <div className="budget-warning" role="status"><AlertTriangle size={14} />{remaining < 0 ? `Over budget by ${money(Math.abs(remaining))}` : remaining === 0 ? "Budget fully used" : `${money(remaining)} remaining · approaching limit`}{onViewTransactions && <button className="warning-action" onClick={() => onViewTransactions(budget)}>View expenses</button>}</div>}{showActions && <div className="management-actions"><button className="row-action" onClick={() => onEdit(budget)}>Edit</button><button className="row-action danger-action" aria-label={`Delete ${budget.category_name} budget`} onClick={() => onDelete(budget)}><Trash2 size={16} /></button></div>}</div>;
  })}{!budgets.length && <EmptyState text="No budgets for this month. Create one to start tracking a limit." />}</div>;
}

function SectionTitle({ title, subtitle, action }) {
  return <div className="section-heading"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>{action}</div>;
}

function EmptyState({ text }) { return <div className="empty-state">{text}</div>; }

export default App;
