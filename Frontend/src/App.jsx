import React, { useState } from "react";
import AuthPage from "./AuthPage";
import Whiteboard from "./Whiteboard";

export default function App() {
  const [username, setUsername] = useState(null);

  return username ? (
    <Whiteboard username={username} onLogout={() => setUsername(null)} />
  ) : (
    <AuthPage onAuth={(u) => setUsername(u)} />
  );
}
