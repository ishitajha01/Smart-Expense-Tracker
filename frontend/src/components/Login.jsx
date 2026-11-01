
import { useState } from "react";
import { useAuth } from "../context/useAuth";
import { registerUser } from "../api/auth";
import "./Login.css";

export default function Login() {
    const { login } = useAuth();

    const [isRegistering, setIsRegistering] = useState(false);
    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            if (isRegistering) {
                await registerUser({
                    username,
                    email,
                    password,
                });
            }

            await login({ username, password });
        } catch (err) {
            const data = err.response?.data;

            setError(
                data
                    ? Object.values(data).flat().join(" ")
                    : "Something went wrong. Please try again."
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-page">
            <div className="auth-card">
                <div className="auth-brand">
                    <span className="auth-logo">🌱</span>
                    <h1>sprout</h1>
                    <p>Your money, your growth.</p>
                </div>

                <div className="auth-heading">
                    <h2>
                        {isRegistering ? "Create your account" : "Welcome back"}
                    </h2>
                    <p>
                        {isRegistering
                            ? "Start growing your financial habits."
                            : "Let's pick up where you left off."}
                    </p>
                </div>

                <form onSubmit={handleSubmit}>
                    <label>Username</label>
                    <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="Enter your username"
                        required
                    />

                    {isRegistering && (
                        <>
                            <label>Email</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="Enter your email"
                                required
                            />
                        </>
                    )}

                    <label>Password</label>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter your password"
                        required
                        minLength={8}
                    />

                    {error && <p className="auth-error">{error}</p>}

                    <button type="submit" disabled={loading}>
                        {loading
                            ? "Please wait..."
                            : isRegistering
                                ? "Create account"
                                : "Sign in"}
                    </button>
                </form>

                <p className="auth-switch">
                    {isRegistering
                        ? "Already have an account?"
                        : "New to Sprout?"}

                    <button
                        type="button"
                        onClick={() => {
                            setIsRegistering(!isRegistering);
                            setError("");
                        }}
                    >
                        {isRegistering ? "Sign in" : "Create account"}
                    </button>
                </p>
            </div>
        </div>
    );
}
