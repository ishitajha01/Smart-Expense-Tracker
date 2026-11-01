
import api from "./client";

// Register a new user.
export const registerUser = async (userData) => {
    const response = await api.post("auth/register/", userData);
    return response.data;
};

// Log in and receive JWT tokens.
export const loginUser = async (credentials) => {
    const response = await api.post("auth/login/", credentials);

    localStorage.setItem("access_token", response.data.access);
    localStorage.setItem("refresh_token", response.data.refresh);

    return response.data;
};

// Log out.
export const logoutUser = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    window.dispatchEvent(new Event("auth:logout"));
};
