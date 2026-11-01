
import axios from "axios";

const api = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000/api/",
    headers: { "Content-Type": "application/json" },
});

// Separate Axios instance for refreshing tokens.
// This prevents refresh requests from triggering the same interceptor.
const refreshClient = axios.create({
    baseURL: "http://127.0.0.1:8000/api/",
});

// Attach access token to outgoing requests.
api.interceptors.request.use((config) => {
    const token = localStorage.getItem("access_token");

    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
});

// Automatically refresh expired access tokens.
api.interceptors.response.use(
    (response) => response,

    async (error) => {
        const originalRequest = error.config;

        if (
            error.response?.status === 401 &&
            originalRequest &&
            !originalRequest._retry &&
            !originalRequest.url.includes("auth/login/") &&
            !originalRequest.url.includes("auth/refresh/")
        ) {
            originalRequest._retry = true;

            const refreshToken = localStorage.getItem("refresh_token");

            if (!refreshToken) {
                localStorage.removeItem("access_token");
                localStorage.removeItem("refresh_token");
                localStorage.removeItem("username");
                window.dispatchEvent(new Event("auth:logout"));
                return Promise.reject(error);
            }

            try {
                const response = await refreshClient.post("auth/refresh/", {
                    refresh: refreshToken,
                });

                const newAccessToken = response.data.access;

                localStorage.setItem("access_token", newAccessToken);

                originalRequest.headers.Authorization =
                    `Bearer ${newAccessToken}`;

                return api(originalRequest);
            } catch (refreshError) {
                localStorage.removeItem("access_token");
                localStorage.removeItem("refresh_token");
                localStorage.removeItem("username");
                window.dispatchEvent(new Event("auth:logout"));

                return Promise.reject(refreshError);
            }
        }

        return Promise.reject(error);
    }
);

export default api;
