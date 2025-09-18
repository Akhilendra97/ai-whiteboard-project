import React, { useState } from "react";
import Whiteboard from "./components/Whiteboard";

function App() {
  const [user, setUser] = useState(null);

  const handleLogin = (username) => {
    setUser(username);
  };

  const handleLogout = () => {
    setUser(null);
  };

  return (
    <div style={{ textAlign: "center", marginTop: "30px" }}>
      <h1>📝 AI Whiteboard</h1>
      {!user ? (
        <div>
          {/* Your login/register UI here */}
          <p>Please login to start drawing.</p>
        </div>
      ) : (
        <div>
          <h2>Welcome, {user} 🎉</h2>
          <button
            onClick={handleLogout}
            style={{ marginBottom: "20px", padding: "5px 10px", background: "red", color: "white" }}
          >
            Logout
          </button>
          <Whiteboard />
        </div>
      )}
    </div>
  );
}

export default App;
