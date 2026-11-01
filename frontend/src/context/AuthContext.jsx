
import { useEffect, useState } from "react";
import { loginUser, logoutUser } from "../api/auth";
import AuthContext from "./auth-context";

export function AuthProvider({ children }) {
    const [isAuthenticated, setIsAuthenticated] = useState(
        Boolean(localStorage.getItem("access_token"))
    );

    useEffect(() => {
        const handleLogout = () => {
            setIsAuthenticated(false);
        };

        window.addEventListener("auth:logout", handleLogout);

        return () => {
            window.removeEventListener("auth:logout", handleLogout);
        };
    }, []);

    const login = async (credentials) => {
        await loginUser(credentials);
        setIsAuthenticated(true);
    };

    const logout = () => {
        logoutUser();
        setIsAuthenticated(false);
    };

    return (
        <AuthContext.Provider
            value={{ isAuthenticated, login, logout }}
        >
            {children}
        </AuthContext.Provider>
    );
}
