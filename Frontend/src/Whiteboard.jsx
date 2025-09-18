import React, { useRef, useState, useEffect } from "react";
import { ChromePicker } from "react-color";

export default function Whiteboard({ username, onLogout }) {
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const [drawing, setDrawing] = useState(false);
  const [color, setColor] = useState("#000000");
  const [brushSize, setBrushSize] = useState(5);
  const [tool, setTool] = useState("brush");
  const [history, setHistory] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const [darkMode, setDarkMode] = useState(false);

  const [gallery, setGallery] = useState([]);

  // Setup canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    canvas.width = window.innerWidth > 900 ? 800 : window.innerWidth - 40;
    canvas.height = 500;
    const ctx = canvas.getContext("2d");
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctxRef.current = ctx;

    fetchGallery();
  }, []);

  // Get touch coords
  const getTouchPos = (touchEvent) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const touch = touchEvent.touches[0];
    return {
      offsetX: touch.clientX - rect.left,
      offsetY: touch.clientY - rect.top,
    };
  };

  // Drawing handlers
  const startDrawing = (e, isTouch = false) => {
    e.preventDefault();
    const { offsetX, offsetY } = isTouch ? getTouchPos(e) : e.nativeEvent;
    ctxRef.current.beginPath();
    ctxRef.current.moveTo(offsetX, offsetY);
    setDrawing(true);
  };

  const draw = (e, isTouch = false) => {
    if (!drawing) return;
    e.preventDefault();
    const { offsetX, offsetY } = isTouch ? getTouchPos(e) : e.nativeEvent;

    if (tool === "brush") {
      ctxRef.current.strokeStyle = color;
      ctxRef.current.lineWidth = brushSize;
      ctxRef.current.lineTo(offsetX, offsetY);
      ctxRef.current.stroke();
    } else if (tool === "eraser") {
      ctxRef.current.strokeStyle = "#ffffff";
      ctxRef.current.lineWidth = brushSize + 5;
      ctxRef.current.lineTo(offsetX, offsetY);
      ctxRef.current.stroke();
    }
  };

  const stopDrawing = (e) => {
    if (!drawing) return;
    e.preventDefault();
    ctxRef.current.closePath();
    setDrawing(false);
    setHistory([...history, canvasRef.current.toDataURL()]);
    setRedoStack([]);
  };

  // Undo/Redo
  const undo = () => {
    if (history.length === 0) return;
    const prev = [...history];
    prev.pop();
    setHistory(prev);

    const img = new Image();
    img.src = prev[prev.length - 1] || "";
    img.onload = () => ctxRef.current.drawImage(img, 0, 0);
  };

  const redo = () => {
    if (redoStack.length === 0) return;
    const newRedo = [...redoStack];
    const restored = newRedo.pop();
    setHistory([...history, restored]);
    setRedoStack(newRedo);

    const img = new Image();
    img.src = restored;
    img.onload = () => ctxRef.current.drawImage(img, 0, 0);
  };

  // Save diagram to backend
  const saveDiagram = async () => {
    const content = canvasRef.current.toDataURL();
    await fetch("/save_diagram", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, content }),
    });
    fetchGallery();
  };

  // Fetch diagrams from backend
  const fetchGallery = async () => {
    const res = await fetch(`/get_diagrams/${username}`);
    if (res.ok) {
      const data = await res.json();
      setGallery(data);
    }
  };

  // Load a diagram back into canvas
  const loadDiagram = (content) => {
    const img = new Image();
    img.src = content;
    img.onload = () => {
      ctxRef.current.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      ctxRef.current.drawImage(img, 0, 0);
    };
  };

  // Delete diagram
  const deleteDiagram = async (id) => {
    await fetch(`/delete_diagram/${id}`, { method: "DELETE" });
    fetchGallery();
  };

  // Download PNG
  const download = () => {
    const link = document.createElement("a");
    link.download = "whiteboard.png";
    link.href = canvasRef.current.toDataURL();
    link.click();
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        background: darkMode
          ? "linear-gradient(to right, #0f2027, #203a43, #2c5364)"
          : "linear-gradient(to right, #6a11cb, #2575fc)",
        padding: "20px",
        color: "white",
      }}
    >
      <h1 style={{ fontSize: "2rem", marginBottom: "15px", fontWeight: "bold" }}>
        🎨 AI Whiteboard
      </h1>

      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: "8px",
          marginBottom: "20px",
        }}
      >
        <ChromePicker color={color} onChange={(c) => setColor(c.hex)} />
        <input
          type="range"
          min="2"
          max="50"
          value={brushSize}
          onChange={(e) => setBrushSize(e.target.value)}
        />
        <button onClick={() => setTool("brush")}>🖌️ Brush</button>
        <button onClick={() => setTool("eraser")}>🧽 Eraser</button>
        <button onClick={undo}>↩️ Undo</button>
        <button onClick={redo}>↪️ Redo</button>
        <button onClick={download}>💾 Save PNG</button>
        <button onClick={saveDiagram}>☁️ Save to DB</button>
        <button onClick={() => setDarkMode(!darkMode)}>
          {darkMode ? "☀️ Light" : "🌙 Dark"}
        </button>
        <button onClick={onLogout} style={{ background: "crimson", color: "white" }}>
          🚪 Logout
        </button>
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        onMouseDown={(e) => startDrawing(e)}
        onMouseMove={(e) => draw(e)}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        onTouchStart={(e) => startDrawing(e, true)}
        onTouchMove={(e) => draw(e, true)}
        onTouchEnd={stopDrawing}
        style={{
          border: "3px solid #444",
          borderRadius: "8px",
          background: "white",
          touchAction: "none",
          marginBottom: "30px",
        }}
      />

      {/* Gallery */}
      <h2>📂 Saved Diagrams</h2>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "15px",
          justifyContent: "center",
          marginTop: "15px",
        }}
      >
        {gallery.map((g) => (
          <div
            key={g.id}
            style={{
              background: "#fff",
              padding: "10px",
              borderRadius: "8px",
              textAlign: "center",
              color: "black",
              boxShadow: "0px 4px 10px rgba(0,0,0,0.2)",
            }}
          >
            <img
              src={g.content}
              alt="diagram"
              width="120"
              style={{ borderRadius: "6px", cursor: "pointer" }}
              onClick={() => loadDiagram(g.content)}
            />
            <br />
            <button
              onClick={() => deleteDiagram(g.id)}
              style={{ marginTop: "8px", background: "red", color: "white", fontSize: "12px" }}
            >
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
