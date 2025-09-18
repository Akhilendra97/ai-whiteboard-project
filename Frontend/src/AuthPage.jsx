import React, { useState } from "react";
import API_URL from "./config";

export default function AuthPage({ onAuth }) {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  async function handleAuth() {
    const endpoint = isLogin ? "/login" : "/register";
    try {
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.detail || data.msg || "Failed");
        return;
      }
      // login returns token + username (register returns msg)
      if (isLogin) {
        localStorage.setItem("token", data.token || "");
        localStorage.setItem("username", data.username || username);
        onAuth(data.username || username);
      } else {
        alert("Registered. Now login.");
        setIsLogin(true);
      }
    } catch (err) {
      alert("Network error");
      console.error(err);
    }
  }

  return (
    <div className="auth-root">
      <div className="auth-card">
        <h2>{isLogin ? "Login" : "Register"}</h2>
        <input placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} />
        <input placeholder="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} />
        <button onClick={handleAuth}>{isLogin ? "Login" : "Register"}</button>
        <p className="muted" onClick={() => setIsLogin(!isLogin)}>{isLogin ? "New? Register" : "Have an account? Login"}</p>
      </div>
    </div>
  );
}
