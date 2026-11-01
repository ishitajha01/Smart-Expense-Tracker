import api from "./client";

export const getTransactions = async () => (await api.get("transactions/")).data;
export const createTransaction = async (transaction) => (await api.post("transactions/", transaction)).data;
export const getCategories = async () => (await api.get("categories/")).data;
export const getBudgets = async (month, year) =>
    (await api.get("budgets/", { params: { month, year } })).data;
export const createBudget = async (budget) => (await api.post("budgets/", budget)).data;
export const updateBudget = async (id, budget) => (await api.patch(`budgets/${id}/`, budget)).data;
export const deleteBudget = async (id) => api.delete(`budgets/${id}/`);
export const createCategory = async (category) => (await api.post("categories/", category)).data;
export const updateCategory = async (id, category) => (await api.patch(`categories/${id}/`, category)).data;
export const deleteCategory = async (id) => api.delete(`categories/${id}/`);
export const updateTransaction = async (id, transaction) => (await api.patch(`transactions/${id}/`, transaction)).data;
export const deleteTransaction = async (id) => api.delete(`transactions/${id}/`);
