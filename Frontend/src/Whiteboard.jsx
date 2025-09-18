import React, { useRef, useState, useEffect } from "react";

const Whiteboard = ({ username }) => {
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState("#000000");
  const [lineWidth, setLineWidth] = useState(3);
  const [savedDiagrams, setSavedDiagrams] = useState([]);

  const API_BASE = "";

  useEffect(() => {
    const canvas = canvasRef.current;
    canvas.width = 800;
    canvas.height = 500;
    const ctx = canvas.getContext("2d");
    ctx.lineCap = "round";
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctxRef.current = ctx;
  }, [color, lineWidth]);

  const startDrawing = (e) => {
    ctxRef.current.beginPath();
    ctxRef.current.moveTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    ctxRef.current.lineTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
    ctxRef.current.stroke();
  };

  const stopDrawing = () => {
    ctxRef.current.closePath();
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    ctxRef.current.clearRect(0, 0, canvas.width, canvas.height);
  };

  // Save canvas to backend
  const saveCanvas = async () => {
    const canvas = canvasRef.current;
    const dataUrl = canvas.toDataURL(); // base64 PNG
    const res = await fetch(`${API_BASE}/save_diagram`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, content: dataUrl }),
    });
    if (res.ok) {
      alert("Diagram saved ✅");
      loadDiagrams();
    } else {
      alert("Failed to save ❌");
    }
  };

  // Load diagrams from backend
  const loadDiagrams = async () => {
    const res = await fetch(`${API_BASE}/get_diagrams/${username}`);
    if (res.ok) {
      const data = await res.json();
      setSavedDiagrams(data);
    }
  };

  // Load selected diagram onto canvas
  const loadToCanvas = (dataUrl) => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    const img = new Image();
    img.src = dataUrl;
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
    };
  };

  return (
    <div>
      <div className="toolbar">
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
        <input type="range" min="1" max="20" value={lineWidth} onChange={(e) => setLineWidth(e.target.value)} />
        <button onClick={clearCanvas} className="btn gray">Clear</button>
        <button onClick={saveCanvas} className="btn green">Save</button>
        <button onClick={loadDiagrams} className="btn blue">Load Saved</button>
      </div>

      <canvas
        ref={canvasRef}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        className="canvas"
      />

      {savedDiagrams.length > 0 && (
        <div className="saved-gallery">
          <h3>Saved Diagrams</h3>
          <div className="gallery">
            {savedDiagrams.map((d) => (
              <img
                key={d.id}
                src={d.content}
                alt="diagram"
                onClick={() => loadToCanvas(d.content)}
                className="thumb"
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Whiteboard;
