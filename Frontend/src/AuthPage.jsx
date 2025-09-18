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
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (res.ok) {
      localStorage.setItem("token", data.token);
      onAuth();
    } else {
      alert(data.detail || "Failed");
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
