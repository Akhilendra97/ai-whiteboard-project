import React, { useRef, useState, useEffect } from "react";
import { ChromePicker } from "react-color";

export default function Whiteboard({ onLogout }) {
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const [drawing, setDrawing] = useState(false);
  const [color, setColor] = useState("#000000");
  const [brushSize, setBrushSize] = useState(5);
  const [tool, setTool] = useState("brush");
  const [history, setHistory] = useState([]);
  const [redoStack, setRedoStack] = useState([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    canvas.width = 800;
    canvas.height = 500;
    const ctx = canvas.getContext("2d");
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctxRef.current = ctx;
  }, []);

  const startDrawing = (e) => {
    const { offsetX, offsetY } = e.nativeEvent;
    ctxRef.current.beginPath();
    ctxRef.current.moveTo(offsetX, offsetY);
    setDrawing(true);
  };

  const draw = (e) => {
    if (!drawing) return;
    const { offsetX, offsetY } = e.nativeEvent;

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

  const stopDrawing = () => {
    if (!drawing) return;
    ctxRef.current.closePath();
    setDrawing(false);
    setHistory([...history, canvasRef.current.toDataURL()]);
    setRedoStack([]);
  };

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
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(to right, #6a11cb, #2575fc)",
      }}
    >
      <div
        style={{
          background: "white",
          padding: "20px",
          borderRadius: "12px",
          boxShadow: "0px 6px 20px rgba(0,0,0,0.3)",
          textAlign: "center",
          width: "900px",
        }}
      >
        <h1
          style={{
            fontSize: "1.8rem",
            marginBottom: "20px",
            fontWeight: "bold",
          }}
        >
          🎨 AI Whiteboard
        </h1>
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: "6px",
            flexWrap: "wrap",
            marginBottom: "20px",
            alignItems: "center",
          }}
        >
          {/* Smaller ChromePicker */}
          <div style={{ transform: "scale(0.7)", transformOrigin: "top left" }}>
            <ChromePicker color={color} onChange={(c) => setColor(c.hex)} />
          </div>

          {/* Brush size slider */}
          <input
            type="range"
            min="2"
            max="50"
            value={brushSize}
            onChange={(e) => setBrushSize(e.target.value)}
          />

          {/* Toolbar Buttons */}
          {["Brush", "Eraser", "Undo", "Redo", "Save"].map((btn, i) => (
            <button
              key={i}
              onClick={() => {
                if (btn === "Brush") setTool("brush");
                if (btn === "Eraser") setTool("eraser");
                if (btn === "Undo") undo();
                if (btn === "Redo") redo();
                if (btn === "Save") download();
              }}
              style={{
                padding: "4px 8px",
                background: "#2575fc",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "12px",
                fontWeight: "500",
              }}
            >
              {btn}
            </button>
          ))}

          {/* Logout Button */}
          <button
            onClick={onLogout}
            style={{
              padding: "4px 8px",
              background: "crimson",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "12px",
              fontWeight: "500",
            }}
          >
            🚪 Logout
          </button>
        </div>

        {/* Canvas */}
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          style={{
            border: "3px solid #444",
            borderRadius: "8px",
            background: "white",
            boxShadow: "0px 4px 12px rgba(0,0,0,0.2)",
          }}
        />
      </div>
    </div>
  );
}
