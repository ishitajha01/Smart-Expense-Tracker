import api from "./client";

export const getTransactions = async () => (await api.get("transactions/")).data;
export const createTransaction = async (transaction) => (await api.post("transactions/", transaction)).data;
export const getCategories = async () => (await api.get("categories/")).data;
export const getBudgets = async (month, year) =>
    (await api.get("budgets/", { params: { month, year } })).data;
