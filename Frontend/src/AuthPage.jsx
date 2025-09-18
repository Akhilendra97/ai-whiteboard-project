import React, { useState } from "react";
import API_URL from "./config";

export default function AuthPage({ onAuth }) {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleAuth = async () => {
    const endpoint = isLogin ? "/login" : "/register";
    try {
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem("token", data.token);
        localStorage.setItem("username", username);
        onAuth();
      } else {
        alert(data.detail || "Failed");
      }
    } catch (err) {
      alert("Network error");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white">
      <div className="bg-white text-black shadow-2xl rounded-xl p-8 w-96 animate-fade-in">
        <h1 className="text-2xl font-bold mb-4 text-center">
          {isLogin ? "🔐 Login" : "📝 Register"}
        </h1>
        <input
          type="text"
          placeholder="Username"
          className="w-full p-2 mb-3 border rounded"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <input
          type="password"
          placeholder="Password"
          className="w-full p-2 mb-3 border rounded"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button
          onClick={handleAuth}
          className="w-full bg-indigo-600 text-white py-2 rounded hover:bg-indigo-700 transition"
        >
          {isLogin ? "Login" : "Register"}
        </button>
        <p
          className="mt-4 text-center text-blue-600 cursor-pointer"
          onClick={() => setIsLogin(!isLogin)}
        >
          {isLogin ? "New user? Register here" : "Already registered? Login here"}
        </p>
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
