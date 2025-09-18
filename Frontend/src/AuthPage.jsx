import React, { useState } from "react";

export default function AuthPage({ onAuth }) {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const API = ""; // set to "" to call same origin

  const handleAuth = async () => {
    if (!username || !password) {
      alert("Please enter username and password");
      return;
    }
    const endpoint = isLogin ? "/login" : "/register";
    try {
      const res = await fetch(`${API}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.toLowerCase(), password }),
      });
      if (res.ok) {
        // login returns { username } in our backend; register returns success message
        if (isLogin) {
          const data = await res.json();
          onAuth(data.username);
        } else {
          alert("Registered. Now login.");
          setIsLogin(true);
        }
      } else {
        const err = await res.json();
        alert(err.detail || "Authentication failed");
      }
    } catch (e) {
      alert("Network error: " + e.message);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.card} className="auth-card">
        <h2 style={{ marginBottom: 12 }}>{isLogin ? "🔐 Login" : "📝 Register"}</h2>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Username"
          style={styles.input}
        />
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          type="password"
          style={styles.input}
        />
        <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 8 }}>
          <button onClick={handleAuth} style={styles.primaryBtn}>
            {isLogin ? "Login" : "Register"}
          </button>
          <button
            onClick={() => {
              setIsLogin(!isLogin);
            }}
            style={styles.ghostBtn}
          >
            {isLogin ? "Create account" : "Use existing"}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(135deg,#6a11cb 0%,#2575fc 100%)",
    padding: 20,
  },
  card: {
    width: 360,
    maxWidth: "95%",
    background: "#fff",
    padding: 24,
    borderRadius: 12,
    boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
    textAlign: "center",
    animation: "fadeIn 500ms ease",
  },
  input: {
    width: "100%",
    padding: "10px 12px",
    marginBottom: 10,
    borderRadius: 8,
    border: "1px solid #ddd",
    outline: "none",
    fontSize: 14,
  },
  primaryBtn: {
    padding: "8px 12px",
    background: "#2575fc",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    boxShadow: "0 6px 12px rgba(37,117,252,0.2)",
    transition: "transform .12s ease",
  },
  ghostBtn: {
    padding: "8px 12px",
    background: "transparent",
    color: "#2575fc",
    border: "1px solid #e6e8ff",
    borderRadius: 8,
    cursor: "pointer",
  },
};
