import React, { useRef, useState, useEffect } from "react";
import { ChromePicker } from "react-color";

export default function Whiteboard() {
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const [drawing, setDrawing] = useState(false);
  const [color, setColor] = useState("#000000");
  const [brushSize, setBrushSize] = useState(5);
  const [tool, setTool] = useState("brush"); // brush, eraser, line, rect, circle, highlighter
  const [darkMode, setDarkMode] = useState(false);
  const [history, setHistory] = useState([]);
  const [redoStack, setRedoStack] = useState([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    canvas.width = window.innerWidth - 300;
    canvas.height = window.innerHeight - 200;
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
      ctxRef.current.strokeStyle = darkMode ? "#1e1e1e" : "#ffffff";
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
    const last = prev.pop();
    setRedoStack([...redoStack, last]);
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
    <div className={`${darkMode ? "bg-gray-900 text-white" : "bg-gray-100"} min-h-screen p-4`}>
      <h1 className="text-3xl font-bold text-center mb-4 animate-pulse">🎨 AI Whiteboard</h1>
      <div className="flex gap-4 mb-4 justify-center">
        <ChromePicker color={color} onChange={(c) => setColor(c.hex)} />
        <input
          type="range"
          min="2"
          max="50"
          value={brushSize}
          onChange={(e) => setBrushSize(e.target.value)}
        />
        <button className="px-3 py-1 bg-blue-500 text-white rounded" onClick={() => setTool("brush")}>
          Brush
        </button>
        <button className="px-3 py-1 bg-red-500 text-white rounded" onClick={() => setTool("eraser")}>
          Eraser
        </button>
        <button className="px-3 py-1 bg-yellow-500 text-black rounded" onClick={undo}>Undo</button>
        <button className="px-3 py-1 bg-green-500 text-black rounded" onClick={redo}>Redo</button>
        <button className="px-3 py-1 bg-purple-500 text-white rounded" onClick={download}>
          Save PNG
        </button>
        <button className="px-3 py-1 bg-gray-700 text-white rounded" onClick={() => setDarkMode(!darkMode)}>
          {darkMode ? "☀️ Light" : "🌙 Dark"}
        </button>
      </div>
      <canvas
        ref={canvasRef}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        className="border-4 border-gray-700 shadow-xl rounded-lg bg-white"
      />
    </div>
  );
}
