import React, { useState } from "react";
import Whiteboard from "./Whiteboard";
import AuthPage from "./AuthPage";

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const handleLogin = () => {
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
  };

  return (
    <>
      {isAuthenticated ? (
        <Whiteboard onLogout={handleLogout} />
      ) : (
        <AuthPage onAuth={handleLogin} />
      )}
    </>
  );
}

export default App;
