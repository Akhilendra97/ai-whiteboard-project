import React, { useState } from "react";
import Whiteboard from "./Whiteboard";
import AuthPage from "./AuthPage";

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem("token"));

  return (
    <>
      {isAuthenticated ? (
        <Whiteboard />
      ) : (
        <AuthPage onAuth={() => setIsAuthenticated(true)} />
      )}
    </>
  );
}

export default App;
