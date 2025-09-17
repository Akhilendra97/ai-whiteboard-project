import { useState, useRef, useEffect } from "react";
import "./App.css";

function App() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [message, setMessage] = useState("");
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const drawing = useRef(false);

  // ------------------------
  // Auth Handlers
  // ------------------------
  const handleRegister = async () => {
    const res = await fetch("/register?username=" + username + "&password=" + password, { method: "POST" });
    const data = await res.json();
    if (res.ok) {
      setMessage("✅ Registered successfully, now login!");
    } else {
      setMessage("❌ " + data.detail);
    }
  };

  const handleLogin = async () => {
    const res = await fetch("/login?username=" + username + "&password=" + password, { method: "POST" });
    const data = await res.json();
    if (res.ok) {
      setIsLoggedIn(true);
      setMessage("✅ Welcome, " + username + "!");
    } else {
      setMessage("❌ " + data.detail);
    }
  };

  // ------------------------
  // Canvas Drawing
  // ------------------------
  useEffect(() => {
    const canvas = canvasRef.current;
    canvas.width = 800;
    canvas.height = 500;
    const ctx = canvas.getContext("2d");
    ctx.lineCap = "round";
    ctx.strokeStyle = "#007BFF";
    ctx.lineWidth = 3;
    ctxRef.current = ctx;
  }, []);

  const startDrawing = (e) => {
    drawing.current = true;
    ctxRef.current.beginPath();
    ctxRef.current.moveTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
  };

  const draw = (e) => {
    if (!drawing.current) return;
    ctxRef.current.lineTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
    ctxRef.current.stroke();
  };

  const stopDrawing = () => {
    drawing.current = false;
    ctxRef.current.closePath();
  };

  return (
    <div className="app">
      <h1>🖊️ AI Whiteboard</h1>

      {!isLoggedIn ? (
        <div className="auth-box">
          <input
            type="text"
            placeholder="👤 Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <input
            type="password"
            placeholder="🔒 Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <div className="btn-row">
            <button className="btn register" onClick={handleRegister}>Register</button>
            <button className="btn login" onClick={handleLogin}>Login</button>
          </div>
          <p className="message">{message}</p>
        </div>
      ) : (
        <div className="board">
          <p className="welcome">Welcome, {username} 👋 Start drawing below:</p>
          <canvas
            ref={canvasRef}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
          />
        </div>
      )}
    </div>
  );
}

export default App;
