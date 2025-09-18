import React, { useState } from "react";
import Whiteboard from "./Whiteboard";
import AuthPage from "./AuthPage";

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem("token"));

  const handleLogout = () => {
    localStorage.removeItem("token");
    setIsAuthenticated(false);
  };

  return (
    <>
      {isAuthenticated ? (
        <div>
          {/* Logout button at top center */}
          <div style={{ textAlign: "center", marginTop: "10px" }}>
            <button
              onClick={handleLogout}
              style={{
                background: "crimson",
                color: "white",
                padding: "8px 16px",
                borderRadius: "5px",
                border: "none",
                cursor: "pointer",
              }}
            >
              🚪 Logout
            </button>
          </div>
          <Whiteboard />
        </div>
      ) : (
        <AuthPage onAuth={() => setIsAuthenticated(true)} />
      )}
    </>
  );
}

export default App;
