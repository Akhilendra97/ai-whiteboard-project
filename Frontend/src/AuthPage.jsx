import React, { useState } from "react";

export default function AuthPage({ onAuth }) {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleAuth = async () => {
    const endpoint = isLogin ? "/login" : "/register";
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: username.toLowerCase(), // ✅ ensure lowercase
        password,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      localStorage.setItem("token", data.token);
      onAuth();
    } else {
      alert(data.detail || "Authentication failed");
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(to right, #6a11cb, #2575fc)",
      }}
    >
      <div
        style={{
          background: "white",
          padding: "30px",
          borderRadius: "12px",
          boxShadow: "0px 6px 20px rgba(0,0,0,0.3)",
          width: "350px",
          textAlign: "center",
          animation: "fadeIn 0.8s ease-in-out",
        }}
      >
        <h1 style={{ fontSize: "1.8rem", marginBottom: "20px" }}>
          {isLogin ? "🔐 Login" : "📝 Register"}
        </h1>
        <input
          type="text"
          placeholder="Username"
          style={{
            width: "100%",
            padding: "10px",
            marginBottom: "12px",
            borderRadius: "6px",
            border: "1px solid #ccc",
          }}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <input
          type="password"
          placeholder="Password"
          style={{
            width: "100%",
            padding: "10px",
            marginBottom: "12px",
            borderRadius: "6px",
            border: "1px solid #ccc",
          }}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button
          onClick={handleAuth}
          style={{
            width: "100%",
            padding: "10px",
            background: "linear-gradient(to right, #2575fc, #6a11cb)",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            fontWeight: "bold",
          }}
        >
          {isLogin ? "Login" : "Register"}
        </button>
        <p
          style={{
            marginTop: "15px",
            color: "#2575fc",
            cursor: "pointer",
            fontWeight: "500",
          }}
          onClick={() => setIsLogin(!isLogin)}
        >
          {isLogin
            ? "New here? Create an account"
            : "Already registered? Login here"}
        </p>
      </div>
    </div>
  );
}
