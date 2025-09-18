import React, { useState } from "react";
import Whiteboard from "./Whiteboard";

function App() {
  const [user, setUser] = useState(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const API_BASE = import.meta.env.VITE_API_BASE || "";

  const register = async () => {
    const res = await fetch(`${API_BASE}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (res.ok) {
      alert("Registered! Now log in.");
    } else {
      alert("Register failed!");
    }
  };

  const login = async () => {
    const res = await fetch(`${API_BASE}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (res.ok) {
      const data = await res.json();
      setUser(data.username);
    } else {
      alert("Login failed!");
    }
  };

  const logout = () => setUser(null);

  return (
    <div className="p-6 text-center">
      <h1 className="text-3xl font-bold mb-6">📝 AI Whiteboard</h1>

      {!user ? (
        <div className="space-y-3">
          <input
            className="border px-3 py-2"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <input
            type="password"
            className="border px-3 py-2"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <div className="space-x-2">
            <button
              onClick={register}
              className="bg-green-500 text-white px-4 py-2 rounded"
            >
              Register
            </button>
            <button
              onClick={login}
              className="bg-blue-500 text-white px-4 py-2 rounded"
            >
              Login
            </button>
          </div>
        </div>
      ) : (
        <div>
          <p className="mb-4 text-xl">Welcome, {user} 🎉</p>
          <Whiteboard />
          <button
            onClick={logout}
            className="mt-4 bg-red-500 text-white px-4 py-2 rounded"
          >
            Logout
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
