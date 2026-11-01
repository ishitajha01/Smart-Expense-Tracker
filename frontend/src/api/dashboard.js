
import api from "./client";

export const getDashboardSummary = async (month, year) => {
    const response = await api.get("dashboard/summary/", {
        params: month && year ? { month, year } : undefined,
    });
    return response.data;
};
