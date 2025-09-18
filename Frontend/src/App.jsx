import React, { useState } from "react";

export default function App() {
  const [user, setUser] = useState(null);
  const [form, setForm] = useState({ username: "", password: "" });

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleLogin = (e) => {
    e.preventDefault();
    // TODO: call backend API with fetch
    setUser(form.username); // Fake login for now
  };

  const handleLogout = () => {
    setUser(null);
    setForm({ username: "", password: "" });
  };

  return (
    <div style={{ fontFamily: "Arial, sans-serif", textAlign: "center", padding: "2rem" }}>
      <h1>📝 AI Whiteboard</h1>

      {!user ? (
        <form onSubmit={handleLogin} style={{ margin: "2rem auto", maxWidth: "300px" }}>
          <input
            type="text"
            name="username"
            placeholder="Username"
            value={form.username}
            onChange={handleChange}
            required
            style={{ display: "block", width: "100%", padding: "0.5rem", marginBottom: "1rem" }}
          />
          <input
            type="password"
            name="password"
            placeholder="Password"
            value={form.password}
            onChange={handleChange}
            required
            style={{ display: "block", width: "100%", padding: "0.5rem", marginBottom: "1rem" }}
          />
          <button
            type="submit"
            style={{
              width: "100%",
              padding: "0.7rem",
              background: "#2563eb",
              color: "white",
              border: "none",
              borderRadius: "5px",
              cursor: "pointer",
            }}
          >
            Login
          </button>
        </form>
      ) : (
        <div>
          <h2>Welcome, {user} 🎉</h2>
          <p>This will be your whiteboard area.</p>
          <button
            onClick={handleLogout}
            style={{
              marginTop: "1rem",
              padding: "0.5rem 1rem",
              background: "#dc2626",
              color: "white",
              border: "none",
              borderRadius: "5px",
              cursor: "pointer",
            }}
          >
            Logout
          </button>
        </div>
      )}
    </div>
  );
}
