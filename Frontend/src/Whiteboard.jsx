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
    canvas.width = window.innerWidth > 900 ? 800 : window.innerWidth - 40;
    canvas.height = window.innerHeight > 600 ? 500 : window.innerHeight - 200;
    const ctx = canvas.getContext("2d");
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctxRef.current = ctx;
  }, []);

  // Convert touch events into mouse-like coordinates
  const getTouchPos = (touchEvent) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const touch = touchEvent.touches[0];
    return {
      offsetX: touch.clientX - rect.left,
      offsetY: touch.clientY - rect.top,
    };
  };

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
          width: "95%",
          maxWidth: "900px",
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

          {/* Smaller Brush Size Slider */}
          <input
            type="range"
            min="2"
            max="50"
            value={brushSize}
            onChange={(e) => setBrushSize(e.target.value)}
            style={{
              width: "80px",
              cursor: "pointer",
            }}
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
                padding: "4px 10px",
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
              padding: "4px 10px",
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

        {/* Canvas with both mouse + touch support */}
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
            boxShadow: "0px 4px 12px rgba(0,0,0,0.2)",
            touchAction: "none", // prevents scrolling while drawing
          }}
        />
      </div>
    </div>
  );
}
