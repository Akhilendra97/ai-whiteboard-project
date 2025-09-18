import React, { useState } from "react";
import AuthPage from "./AuthPage";
import Whiteboard from "./Whiteboard";

export default function App() {
  const stored = localStorage.getItem("username");
  const [user, setUser] = useState(stored || null);

  const onAuth = (username) => {
    setUser(username);
    localStorage.setItem("username", username);
  };

  const onLogout = () => {
    localStorage.removeItem("username");
    localStorage.removeItem("token");
    setUser(null);
  };

  return user ? <Whiteboard onLogout={onLogout} /> : <AuthPage onAuth={onAuth} />;
}
