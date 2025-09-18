// Frontend/src/Whiteboard.jsx
import React, { useRef, useState, useEffect } from "react";
import { ChromePicker } from "react-color";
import jsPDF from "jspdf";

/*
 Props:
  - username: string (current logged user)
  - onLogout: function
*/

export default function Whiteboard({ username, onLogout }) {
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);

  // state
  const [color, setColor] = useState("#111111");
  const [brushSize, setBrushSize] = useState(4);
  const [tool, setTool] = useState("brush"); // brush, eraser, line, rect, circle
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState(null);
  const [history, setHistory] = useState([]); // dataURL snapshots
  const [redoStack, setRedoStack] = useState([]);
  const [savedDiagrams, setSavedDiagrams] = useState([]);
  const [selectedDiagramId, setSelectedDiagramId] = useState(null);
  const [darkMode, setDarkMode] = useState(false);
  const API_BASE = ""; // same origin

  // responsive canvas sizing
  useEffect(() => {
    const canvas = canvasRef.current;
    const setSize = () => {
      const maxW = Math.min(window.innerWidth - 40, 1000);
      const width = maxW;
      const height = Math.min(window.innerHeight - 300, 700);
      canvas.width = width;
      canvas.height = height;
      // if history has last state, draw it
      const ctx = canvas.getContext("2d");
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctxRef.current = ctx;
      if (history.length) {
        const img = new Image();
        img.src = history[history.length - 1];
        img.onload = () => ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      } else {
        // initial clear
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    };
    setSize();
    window.addEventListener("resize", setSize);
    return () => window.removeEventListener("resize", setSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Helper to push snapshot to history
  const pushHistory = () => {
    const data = canvasRef.current.toDataURL();
    setHistory((h) => {
      const next = [...h, data];
      // keep history length reasonable
      if (next.length > 50) next.shift();
      return next;
    });
    setRedoStack([]);
  };

  // get pointer pos (handles mouse and touch)
  const getPointer = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    if (e.touches && e.touches[0]) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    } else {
      return {
        x: e.nativeEvent.offsetX,
        y: e.nativeEvent.offsetY,
      };
    }
  };

  // Start drawing (or begin shape)
  const handlePointerDown = (e) => {
    e.preventDefault();
    const ctx = ctxRef.current;
    const p = getPointer(e);
    setIsDrawing(true);
    setStartPos(p);

    if (tool === "brush" || tool === "eraser") {
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.strokeStyle = tool === "eraser" ? "#ffffff" : color;
      ctx.lineWidth = tool === "eraser" ? brushSize + 6 : brushSize;
      ctx.globalCompositeOperation = tool === "eraser" ? "destination-out" : "source-over";
    } else {
      // for shapes we draw preview on mouse move; store initial state snapshot
      pushHistory();
    }
  };

  // Move pointer (draw or preview shape)
  const handlePointerMove = (e) => {
    if (!isDrawing) return;
    const ctx = ctxRef.current;
    const p = getPointer(e);

    if (tool === "brush" || tool === "eraser") {
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    } else {
      // shape preview: restore last snapshot then draw shape preview on top
      const last = history[history.length - 1];
      const canvas = canvasRef.current;
      const tempImg = new Image();
      tempImg.src = last || canvas.toDataURL();
      tempImg.onload = () => {
        // clear then draw snapshot
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(tempImg, 0, 0, canvas.width, canvas.height);

        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = brushSize;
        const sx = startPos.x, sy = startPos.y;
        if (tool === "line") {
          ctx.moveTo(sx, sy);
          ctx.lineTo(p.x, p.y);
          ctx.stroke();
        } else if (tool === "rect") {
          ctx.strokeRect(sx, sy, p.x - sx, p.y - sy);
        } else if (tool === "circle") {
          const radius = Math.hypot(p.x - sx, p.y - sy);
          ctx.beginPath();
          ctx.arc(sx, sy, radius, 0, Math.PI * 2);
          ctx.stroke();
        }
      };
    }
  };

  // Finish pointer action
  const handlePointerUp = (e) => {
    if (!isDrawing) return;
    const ctx = ctxRef.current;
    const p = getPointer(e);
    setIsDrawing(false);

    if (tool === "brush" || tool === "eraser") {
      ctx.closePath();
      pushHistory();
      ctx.globalCompositeOperation = "source-over";
    } else {
      // finalize shape: draw shape onto current canvas (history already has snapshot)
      const last = history[history.length - 1];
      const canvas = canvasRef.current;
      const tempImg = new Image();
      tempImg.src = last || canvas.toDataURL();
      tempImg.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(tempImg, 0, 0, canvas.width, canvas.height);
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = brushSize;
        const sx = startPos.x, sy = startPos.y;
        if (tool === "line") {
          ctx.moveTo(sx, sy);
          ctx.lineTo(p.x, p.y);
          ctx.stroke();
        } else if (tool === "rect") {
          ctx.strokeRect(sx, sy, p.x - sx, p.y - sy);
        } else if (tool === "circle") {
          const radius = Math.hypot(p.x - sx, p.y - sy);
          ctx.beginPath();
          ctx.arc(sx, sy, radius, 0, Math.PI * 2);
          ctx.stroke();
        }
        // push final state
        pushHistory();
      };
    }
  };

  // Undo / Redo
  const handleUndo = () => {
    if (history.length <= 1) {
      // clear canvas
      const canvas = canvasRef.current;
      const ctx = ctxRef.current;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      setHistory([]);
      setRedoStack([]);
      return;
    }
    setRedoStack((r) => [history[history.length - 1], ...r]);
    setHistory((h) => {
      const next = h.slice(0, -1);
      const img = new Image();
      img.src = next[next.length - 1] || "";
      img.onload = () => {
        const canvas = canvasRef.current;
        const ctx = ctxRef.current;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      };
      return next;
    });
  };

  const handleRedo = () => {
    if (!redoStack.length) return;
    const [top, ...rest] = redoStack;
    setRedoStack(rest);
    setHistory((h) => {
      const next = [...h, top];
      const img = new Image();
      img.src = top;
      img.onload = () => {
        const canvas = canvasRef.current;
        const ctx = ctxRef.current;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      };
      return next;
    });
  };

  // Export PNG
  const exportPNG = () => {
    const link = document.createElement("a");
    link.download = `diagram-${Date.now()}.png`;
    link.href = canvasRef.current.toDataURL("image/png");
    link.click();
  };

  // Export PDF using jsPDF
  const exportPDF = () => {
    const doc = new jsPDF({
      orientation: canvasRef.current.width > canvasRef.current.height ? "l" : "p",
      unit: "px",
      format: [canvasRef.current.width, canvasRef.current.height],
    });
    const imgData = canvasRef.current.toDataURL("image/png");
    doc.addImage(imgData, "PNG", 0, 0, canvasRef.current.width, canvasRef.current.height);
    doc.save(`diagram-${Date.now()}.pdf`);
  };

  // Gallery API calls
  const fetchGallery = async () => {
    try {
      const res = await fetch(`${API_BASE}/get_diagrams/${encodeURIComponent(username)}`);
      if (res.ok) {
        const data = await res.json();
        setSavedDiagrams(data);
      } else {
        setSavedDiagrams([]);
      }
    } catch (err) {
      console.error("fetchGallery:", err);
    }
  };

  // Save new diagram (or update if selectedDiagramId present)
  const saveDiagram = async () => {
    const content = canvasRef.current.toDataURL();
    const payload = { username, content, id: selectedDiagramId }; // id optional
    const res = await fetch(`${API_BASE}/save_diagram`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      await fetchGallery();
      alert("Saved");
    } else {
      const err = await res.json();
      alert("Save failed: " + (err.detail || res.status));
    }
  };

  // Delete diagram by id
  const deleteDiagram = async (id) => {
    if (!confirm("Delete this diagram?")) return;
    const res = await fetch(`${API_BASE}/delete_diagram/${id}`, { method: "DELETE" });
    if (res.ok) {
      await fetchGallery();
      // If we were editing this diagram, clear selection
      if (selectedDiagramId === id) {
        setSelectedDiagramId(null);
        // clear canvas
        const canvas = canvasRef.current;
        const ctx = ctxRef.current;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        setHistory([]);
      }
    } else {
      alert("Delete failed");
    }
  };

  // Load diagram into canvas (and allow edit)
  const loadDiagram = (diagram) => {
    const img = new Image();
    img.src = diagram.content;
    img.onload = () => {
      const canvas = canvasRef.current;
      const ctx = ctxRef.current;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      // set history snapshot and selected id
      const snapshot = canvas.toDataURL();
      setHistory([snapshot]);
      setRedoStack([]);
      setSelectedDiagramId(diagram.id);
    };
  };

  // initial gallery fetch
  useEffect(() => {
    if (username) fetchGallery();
    // eslint-disable-next-line
  }, [username]);

  // small CSS styles (inline for simplicity)
  const btnStyle = {
    padding: "6px 10px",
    background: "#2575fc",
    color: "white",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: 600,
    transition: "transform 0.12s ease, box-shadow 0.12s ease",
  };
  const btnHover = { transform: "translateY(-2px)", boxShadow: "0 6px 12px rgba(0,0,0,0.18)" };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-start",
        background: darkMode ? "#0b1020" : "linear-gradient(to right,#6a11cb,#2575fc)",
        padding: 16,
        gap: 16,
      }}
    >
      {/* Header card */}
      <div
        style={{
          width: "95%",
          maxWidth: 1100,
          background: darkMode ? "#0f1724" : "white",
          borderRadius: 14,
          padding: 16,
          boxShadow: "0 10px 30px rgba(0,0,0,0.18)",
          color: darkMode ? "#fff" : "#111",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div>
            <h2 style={{ margin: 0 }}>🎨 AI Whiteboard</h2>
            <div style={{ fontSize: 13, opacity: 0.8 }}>User: {username}</div>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              onClick={() => {
                setDarkMode((d) => !d);
              }}
              style={{ ...btnStyle, background: darkMode ? "#ffb86b" : "#111827" }}
              onMouseOver={(e) => (e.currentTarget.style.transform = btnHover.transform)}
              onMouseOut={(e) => (e.currentTarget.style.transform = "")}
            >
              {darkMode ? "☀️ Light" : "🌙 Dark"}
            </button>

            <button
              onClick={() => {
                // quick clear
                if (!confirm("Clear board?")) return;
                const canvas = canvasRef.current;
                const ctx = ctxRef.current;
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = "#ffffff";
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                setHistory([]);
                setRedoStack([]);
                setSelectedDiagramId(null);
              }}
              style={{ ...btnStyle, background: "#ef4444" }}
            >
              Clear
            </button>

            <button
              onClick={onLogout}
              style={{ ...btnStyle, background: "#6b7280" }}
            >
              Logout
            </button>
          </div>
        </div>

        {/* Toolbar */}
        <div
          style={{
            marginTop: 14,
            display: "flex",
            gap: 8,
            alignItems: "center",
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          {/* compact color picker */}
          <div style={{ transform: "scale(0.7)", transformOrigin: "top left" }}>
            <ChromePicker color={color} onChange={(c) => setColor(c.hex)} />
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <input
              title="Brush size"
              type="range"
              min="1"
              max="40"
              value={brushSize}
              onChange={(e) => setBrushSize(parseInt(e.target.value, 10))}
              style={{ width: 80 }}
            />

            {/* tool buttons */}
            {[
              { k: "brush", t: "🖌️" },
              { k: "eraser", t: "🧽" },
              { k: "line", t: "↔️" },
              { k: "rect", t: "▭" },
              { k: "circle", t: "◯" },
            ].map((it) => (
              <button
                key={it.k}
                onClick={() => setTool(it.k)}
                style={{
                  ...btnStyle,
                  background: tool === it.k ? "#111827" : "#2575fc",
                  padding: "6px 8px",
                }}
              >
                <span style={{ fontSize: 16 }}>{it.t}</span>
              </button>
            ))}

            <button onClick={handleUndo} style={btnStyle}>↩️</button>
            <button onClick={handleRedo} style={btnStyle}>↪️</button>
            <button onClick={exportPNG} style={btnStyle}>💾 PNG</button>
            <button onClick={exportPDF} style={btnStyle}>📄 PDF</button>

            <button onClick={saveDiagram} style={{ ...btnStyle, background: "#10b981" }}>
              💾 Save
            </button>

            <button onClick={fetchGallery} style={{ ...btnStyle, background: "#8b5cf6" }}>
              📚 Gallery
            </button>
          </div>
        </div>

        {/* Canvas area */}
        <div style={{ marginTop: 16, display: "flex", justifyContent: "center" }}>
          <canvas
            ref={canvasRef}
            onMouseDown={handlePointerDown}
            onMouseMove={handlePointerMove}
            onMouseUp={handlePointerUp}
            onMouseLeave={handlePointerUp}
            onTouchStart={(e) => handlePointerDown(e)}
            onTouchMove={(e) => handlePointerMove(e)}
            onTouchEnd={(e) => handlePointerUp(e)}
            style={{
              border: "2px solid rgba(0,0,0,0.12)",
              borderRadius: 8,
              width: "100%",
              maxWidth: 980,
              background: darkMode ? "#071022" : "#fff",
              touchAction: "none",
            }}
          />
        </div>
      </div>

      {/* Gallery area below */}
      <div
        style={{
          width: "95%",
          maxWidth: 1100,
          marginTop: 12,
          background: darkMode ? "#041226" : "white",
          borderRadius: 12,
          padding: 12,
          boxShadow: "0 8px 26px rgba(0,0,0,0.12)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <h3 style={{ margin: 0 }}>Saved Diagrams</h3>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={fetchGallery} style={btnStyle}>Refresh</button>
            <button onClick={() => { setSelectedDiagramId(null); setHistory([]); const c=canvasRef.current; ctxRef.current.clearRect(0,0,c.width,c.height); ctxRef.current.fillStyle="#fff"; ctxRef.current.fillRect(0,0,c.width,c.height); }} style={btnStyle}>New</button>
          </div>
        </div>

        {savedDiagrams.length === 0 ? (
          <div style={{ padding: 16, color: "#6b7280" }}>No saved diagrams yet. Click Save to store your work.</div>
        ) : (
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {savedDiagrams.map((d) => (
              <div key={d.id} style={{ width: 160, borderRadius: 8, overflow: "hidden", boxShadow: "0 6px 18px rgba(0,0,0,0.08)" }}>
                <img
                  src={d.content}
                  alt={"diagram-" + d.id}
                  style={{ width: "100%", height: 100, objectFit: "cover", display: "block", cursor: "pointer" }}
                  onClick={() => loadDiagram(d)}
                />
                <div style={{ display: "flex", justifyContent: "space-between", padding: 8, background: darkMode ? "#02121b" : "#fff" }}>
                  <button onClick={() => loadDiagram(d)} style={{ ...btnStyle, background: "#111827", padding: "6px 8px", fontSize: 12 }}>Edit</button>
                  <button onClick={() => deleteDiagram(d.id)} style={{ ...btnStyle, background: "#ef4444", padding: "6px 8px", fontSize: 12 }}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
