import { useRef, useState, useEffect } from "react";

function App() {
  const canvasRef = useRef(null);
  const ws = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);

  const [token, setToken] = useState(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [diagrams, setDiagrams] = useState([]);

  // connect WebSocket
  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    ws.current = new WebSocket(`${protocol}://${window.location.host}/ws`);

    ws.current.onmessage = (event) => {
      const ctx = canvasRef.current.getContext("2d");
      const obj = JSON.parse(event.data);
      if (obj.x !== undefined && obj.y !== undefined) {
        ctx.fillRect(obj.x, obj.y, 2, 2);
      }
    };

    return () => ws.current.close();
  }, []);

  const startDrawing = () => setIsDrawing(true);
  const stopDrawing = () => setIsDrawing(false);

  const draw = (e) => {
    if (!isDrawing) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const ctx = canvasRef.current.getContext("2d");
    ctx.fillRect(x, y, 2, 2);

    ws.current.send(JSON.stringify({ x, y }));
  };

  // -------------------------
  // Auth + Diagram Functions
  // -------------------------

  const register = async () => {
    await fetch(`/register?username=${username}&password=${password}`, {
      method: "POST",
    });
    alert("Registered! Now log in.");
  };

  const login = async () => {
    const res = await fetch("/login", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ username, password }),
    });
    const data = await res.json();
    if (data.access_token) {
      setToken(data.access_token);
      alert("Logged in!");
    } else {
      alert("Login failed!");
    }
  };

  const saveDiagram = async () => {
    const content = canvasRef.current.toDataURL();
    await fetch(`/save_diagram?content=${encodeURIComponent(content)}`, {
      method: "POST",
      headers: { Authorization: "Bearer " + token },
    });
    alert("Diagram saved!");
  };

  const loadDiagrams = async () => {
    const res = await fetch("/my_diagrams", {
      headers: { Authorization: "Bearer " + token },
    });
    const data = await res.json();
    setDiagrams(data);
  };

  return (
    <div style={{ padding: "20px" }}>
      <h2>AI Whiteboard</h2>

      {!token ? (
        <div>
          <input
            placeholder="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <input
            placeholder="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button onClick={register}>Register</button>
          <button onClick={login}>Login</button>
        </div>
      ) : (
        <div>
          <button onClick={saveDiagram}>Save Diagram</button>
          <button onClick={loadDiagrams}>Load My Diagrams</button>
        </div>
      )}

      <canvas
        ref={canvasRef}
        width={800}
        height={600}
        onMouseDown={startDrawing}
        onMouseUp={stopDrawing}
        onMouseMove={draw}
        style={{ border: "1px solid black", marginTop: "10px" }}
      />

      {diagrams.length > 0 && (
        <div>
          <h3>My Diagrams</h3>
          {diagrams.map((d) => (
            <img
              key={d.id}
              src={d.content}
              alt="diagram"
              width="200"
              style={{ margin: "5px" }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default App;
