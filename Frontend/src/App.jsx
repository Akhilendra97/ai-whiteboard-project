import React, { useState } from "react";
import Whiteboard from "./Whiteboard";

function App() {
  const [user, setUser] = useState(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const API_BASE = "";

  const register = async () => {
    const res = await fetch(`${API_BASE}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    res.ok ? alert("Registered! Now login.") : alert("Register failed!");
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
    <div className="app">
      <h1 className="title">📝 AI Whiteboard</h1>

      {!user ? (
        <div className="auth-box">
          <input
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <div className="btn-group">
            <button onClick={register} className="btn green">Register</button>
            <button onClick={login} className="btn blue">Login</button>
          </div>
        </div>
      ) : (
        <div>
          <h2>Welcome, {user} 🎉</h2>
          <button onClick={logout} className="btn red">Logout</button>
          <Whiteboard username={user} />
        </div>
      )}
    </div>
  );
}

export default App;
