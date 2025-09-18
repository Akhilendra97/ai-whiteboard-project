// Frontend/src/Whiteboard.jsx
import React, { useRef, useState, useEffect, useCallback } from "react";
import { ChromePicker } from "react-color";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

/*
  Whiteboard.jsx
  - Props: username (string), onLogout (function)
  - Features:
    - Brush + Eraser
    - Shapes: Line, Rectangle, Circle
    - Grid overlay (XY grid / graph paper)
    - Undo / Redo (history snapshots)
    - Save (create / update) + Gallery (thumbnails with title)
    - Rename diagram, Delete diagram
    - Export PNG + Export PDF
    - Tooltips: hover on desktop, tap-hold on mobile
    - Responsive toolbar (wraps / stacks on small screens)
    - Touch + Mouse support (mobile-friendly)
    - Dark / Light theme
    - Animated buttons and compact UI
*/

const API_ROOT = ""; // same origin. If backend is on different domain, set it here e.g. "https://your-backend.app"

export default function Whiteboard({ username, onLogout }) {
  // Refs
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const ctxRef = useRef(null);

  // Drawing & UI state
  const [color, setColor] = useState("#111111");
  const [brushSize, setBrushSize] = useState(4);
  const [tool, setTool] = useState("brush"); // brush, eraser, line, rect, circle
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState(null); // for shapes
  const [history, setHistory] = useState([]); // array of dataURL snapshots
  const [redoStack, setRedoStack] = useState([]);
  const [savedDiagrams, setSavedDiagrams] = useState([]); // gallery items: {id, title, content}
  const [selectedDiagramId, setSelectedDiagramId] = useState(null); // editing existing
  const [titleInput, setTitleInput] = useState("");
  const [showGrid, setShowGrid] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [isMobileTooltipActive, setIsMobileTooltipActive] = useState(false);
  const [tooltipText, setTooltipText] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [canvasWidth, setCanvasWidth] = useState(900);
  const [canvasHeight, setCanvasHeight] = useState(500);

  // token or username approach
  // If you use JWT stored in localStorage, set the token retrieval here:
  const API_TOKEN = localStorage.getItem("token") || null;

  // ----------------------------
  // Initialization & Responsive sizing
  // ----------------------------
  const computeCanvasSize = useCallback(() => {
    // max width limited for desktop, responsive for mobile
    const pad = 48; // left+right paddings considered
    const maxWidth = Math.min(window.innerWidth - pad, 1100);
    const maxHeight = Math.min(window.innerHeight - 300, 760);
    setCanvasWidth(maxWidth);
    setCanvasHeight(maxHeight);
  }, []);

  useEffect(() => {
    computeCanvasSize();
    window.addEventListener("resize", computeCanvasSize);
    return () => window.removeEventListener("resize", computeCanvasSize);
  }, [computeCanvasSize]);

  useEffect(() => {
    // create canvas and context
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    const ctx = canvas.getContext("2d");
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctxRef.current = ctx;

    // initialize white background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // load gallery on mount / username change
    if (username) fetchGallery();

    // push initial empty snapshot
    setHistory([canvas.toDataURL()]);
    setRedoStack([]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasWidth, canvasHeight, username]);

  // ----------------------------
  // Helper: grid drawing
  // ----------------------------
  const drawGridOverlay = useCallback((ctx) => {
    if (!showGrid) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const step = 25;
    ctx.save();
    ctx.strokeStyle = darkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= canvas.width; x += step) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
    }
    for (let y = 0; y <= canvas.height; y += step) {
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
    }
    ctx.stroke();
    ctx.restore();
  }, [showGrid, darkMode]);

  // ----------------------------
  // History utilities
  // ----------------------------
  const pushHistory = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const data = canvas.toDataURL("image/png");
    setHistory(prev => {
      const next = [...prev, data];
      // keep history bounded
      if (next.length > 60) next.shift();
      return next;
    });
    setRedoStack([]);
  }, []);

  const undo = () => {
    setHistory(prev => {
      if (prev.length <= 1) {
        // clear canvas to white
        const canvas = canvasRef.current;
        const ctx = ctxRef.current;
        ctx.clearRect(0,0,canvas.width, canvas.height);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0,0,canvas.width, canvas.height);
        return [canvas.toDataURL()];
      }
      const top = prev[prev.length - 1];
      setRedoStack(r => [top, ...r]);
      const next = prev.slice(0, -1);
      const img = new Image();
      img.src = next[next.length - 1] || "";
      img.onload = () => {
        const ctx = ctxRef.current;
        const canvas = canvasRef.current;
        ctx.clearRect(0,0,canvas.width, canvas.height);
        if (next.length) ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        else {
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0,0,canvas.width, canvas.height);
        }
        drawGridOverlay(ctx);
      };
      return next;
    });
  };

  const redo = () => {
    setRedoStack(prev => {
      if (prev.length === 0) return prev;
      const [top, ...rest] = prev;
      setHistory(h => {
        const next = [...h, top];
        const img = new Image();
        img.src = top;
        img.onload = () => {
          const ctx = ctxRef.current;
          const canvas = canvasRef.current;
          ctx.clearRect(0,0,canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          drawGridOverlay(ctx);
        };
        return next;
      });
      return rest;
    });
  };

  // ----------------------------
  // Pointer handling: mouse + touch
  // ----------------------------
  const getPointerPos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    if (e.touches && e.touches[0]) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top
      };
    } else if (e.nativeEvent && typeof e.nativeEvent.offsetX === "number") {
      return {
        x: e.nativeEvent.offsetX,
        y: e.nativeEvent.offsetY
      };
    } else {
      // fallback using clientX/Y
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
    }
  };

  const handlePointerDown = (e) => {
    e.preventDefault();
    const pos = getPointerPos(e);
    const ctx = ctxRef.current;
    if (!ctx) return;

    if (tool === "brush" || tool === "eraser") {
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
      ctx.strokeStyle = tool === "eraser" ? "#ffffff" : color;
      ctx.lineWidth = tool === "eraser" ? brushSize + 6 : brushSize;
      ctx.globalCompositeOperation = tool === "eraser" ? "destination-out" : "source-over";
      setIsDrawing(true);
    } else {
      // shapes: store start pos and take a snapshot for preview
      setStartPos(pos);
      // push snapshot so preview can restore it
      pushHistory();
    }
  };

  const handlePointerMove = (e) => {
    if (!isDrawing && !startPos) return; // nothing to do
    e.preventDefault();
    const pos = getPointerPos(e);
    const ctx = ctxRef.current;
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;

    // If shape preview, we need to restore last snapshot and draw preview over it
    if (tool === "line" || tool === "rect" || tool === "circle") {
      const last = history[history.length - 1] || canvas.toDataURL();
      const img = new Image();
      img.src = last;
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        // draw grid overlay if present
        drawGridOverlay(ctx);
        // draw preview shape
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(1, brushSize);
        ctx.setLineDash([6,4]);
        if (tool === "line" && startPos) {
          ctx.beginPath();
          ctx.moveTo(startPos.x, startPos.y);
          ctx.lineTo(pos.x, pos.y);
          ctx.stroke();
        } else if (tool === "rect" && startPos) {
          ctx.strokeRect(startPos.x, startPos.y, pos.x - startPos.x, pos.y - startPos.y);
        } else if (tool === "circle" && startPos) {
          const dx = pos.x - startPos.x;
          const dy = pos.y - startPos.y;
          const r = Math.sqrt(dx*dx + dy*dy);
          ctx.beginPath();
          ctx.arc(startPos.x, startPos.y, r, 0, Math.PI*2);
          ctx.stroke();
        }
        ctx.restore();
      };
      return;
    }

    // Normal drawing (brush/eraser)
    if (isDrawing) {
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    }
  };

  const handlePointerUp = (e) => {
    e?.preventDefault();
    const pos = getPointerPos(e || {});
    const ctx = ctxRef.current;
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;

    if (tool === "brush" || tool === "eraser") {
      ctx.closePath();
      setIsDrawing(false);
      ctx.globalCompositeOperation = "source-over";
      pushHistory();
    } else if (startPos) {
      // finalize shape drawing onto canvas based on startPos -> pos
      // restore last snapshot
      const last = history[history.length - 1] || canvas.toDataURL();
      const img = new Image();
      img.src = last;
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(1, brushSize);
        ctx.setLineDash([]);
        if (tool === "line") {
          ctx.beginPath();
          ctx.moveTo(startPos.x, startPos.y);
          ctx.lineTo(pos.x, pos.y);
          ctx.stroke();
        } else if (tool === "rect") {
          ctx.strokeRect(startPos.x, startPos.y, pos.x - startPos.x, pos.y - startPos.y);
        } else if (tool === "circle") {
          const dx = pos.x - startPos.x;
          const dy = pos.y - startPos.y;
          const r = Math.sqrt(dx*dx + dy*dy);
          ctx.beginPath();
          ctx.arc(startPos.x, startPos.y, r, 0, Math.PI*2);
          ctx.stroke();
        }
        ctx.restore();

        // push final snapshot
        pushHistory();
        setStartPos(null);
      };
    } else {
      // nothing
      setStartPos(null);
      setIsDrawing(false);
    }
  };

  // Attach pointer event listeners with passive: false to prevent scroll while drawing on mobile
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // we use React synthetic events in JSX for cross-platform, but ensure touch-action none on canvas style
    // so browser doesn't pan/zoom while drawing
    return () => {
      // cleanup if needed
    };
  }, []);

  // ----------------------------
  // Gallery / Backend actions
  // ----------------------------
  const fetchGallery = async () => {
    if (!username) return;
    try {
      const url = `${API_ROOT}/get_diagrams/${encodeURIComponent(username)}`;
      const res = await fetch(url, { headers: API_TOKEN ? { Authorization: `Bearer ${API_TOKEN}` } : {} });
      if (!res.ok) {
        console.error("fetchGallery failed", res.status);
        return;
      }
      const data = await res.json();
      // Normalize to { id, title, content }
      const items = data.map(item => ({
        id: item.id || item.diagram_id || item.id,
        title: item.title || item.name || `Diagram ${item.id}`,
        content: item.content || item.image || item.data || item.img || ""
      }));
      setSavedDiagrams(items);
    } catch (e) {
      console.error("fetchGallery error", e);
    }
  };

  const saveDiagram = async ({ overwriteId = null } = {}) => {
    if (!username) {
      alert("Username missing. Please login again.");
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    setIsSaving(true);
    try {
      const content = canvas.toDataURL("image/png");
      const payload = {
        username,
        content,
        title: titleInput || `Diagram ${new Date().toLocaleString()}`
      };
      if (overwriteId) payload.id = overwriteId;

      const res = await fetch(`${API_ROOT}/save_diagram`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(API_TOKEN ? { Authorization: `Bearer ${API_TOKEN}` } : {})
        },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const txt = await res.text();
        console.error("saveDiagram failed", res.status, txt);
        alert("Save failed: " + (txt || res.status));
      } else {
        await fetchGallery();
        setSelectedDiagramId(overwriteId || null);
        alert("Saved successfully");
      }
    } catch (err) {
      console.error("saveDiagram error", err);
      alert("Network error while saving");
    }
    setIsSaving(false);
  };

  const deleteDiagram = async (id) => {
    if (!confirm("Delete this diagram?")) return;
    try {
      const res = await fetch(`${API_ROOT}/delete_diagram/${id}`, {
        method: "DELETE",
        headers: API_TOKEN ? { Authorization: `Bearer ${API_TOKEN}` } : {}
      });
      if (!res.ok) {
        const txt = await res.text();
        console.error("deleteDiagram failed", res.status, txt);
        alert("Delete failed");
      } else {
        if (selectedDiagramId === id) {
          // clear selection
          setSelectedDiagramId(null);
          // clear canvas
          const ctx = ctxRef.current;
          const canvas = canvasRef.current;
          ctx.clearRect(0,0,canvas.width, canvas.height);
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0,0,canvas.width, canvas.height);
          setHistory([canvas.toDataURL()]);
        }
        await fetchGallery();
      }
    } catch (err) {
      console.error("delete error", err);
      alert("Network error");
    }
  };

  const loadDiagramToCanvas = (diagram) => {
    if (!diagram?.content) return;
    const img = new Image();
    img.src = diagram.content;
    img.onload = () => {
      const canvas = canvasRef.current;
      const ctx = ctxRef.current;
      ctx.clearRect(0,0,canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      drawGridOverlay(ctx);
      // push snapshot and set selected id
      setHistory([canvas.toDataURL()]);
      setSelectedDiagramId(diagram.id);
      setTitleInput(diagram.title || "");
    };
  };

  const renameDiagram = async (id, newTitle) => {
    try {
      const res = await fetch(`${API_ROOT}/rename_diagram/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(API_TOKEN ? { Authorization: `Bearer ${API_TOKEN}` } : {})
        },
        body: JSON.stringify({ title: newTitle })
      });
      if (!res.ok) {
        console.error("rename failed", res.status);
        alert("Rename failed");
      } else {
        await fetchGallery();
      }
    } catch (err) {
      console.error("rename error", err);
      alert("Network error");
    }
  };

  // ----------------------------
  // Export functions
  // ----------------------------
  const exportPNG = () => {
    const canvas = canvasRef.current;
    const link = document.createElement("a");
    link.download = `diagram-${Date.now()}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  const exportPDF = async () => {
    setIsExporting(true);
    try {
      // Use html2canvas to capture the canvas container (including title or UI if desired)
      const node = canvasRef.current;
      const canvasForExport = await html2canvas(node, { useCORS: true, scale: 2 });
      const imgData = canvasForExport.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: canvasForExport.width > canvasForExport.height ? "landscape" : "portrait",
        unit: "px",
        format: [canvasForExport.width, canvasForExport.height]
      });
      pdf.addImage(imgData, "PNG", 0, 0, canvasForExport.width, canvasForExport.height);
      pdf.save(`diagram-${Date.now()}.pdf`);
    } catch (err) {
      console.error("exportPDF error", err);
      alert("Export failed");
    }
    setIsExporting(false);
  };

  // ----------------------------
  // Tooltips: hover + mobile tap-hold
  // ----------------------------
  // Mobile tap-hold: we trigger tooltip on touchstart -> show after 450ms, hide on touchend/cancel
  let touchTimer = null;
  const handleToolTouchStart = (label) => {
    clearTimeout(touchTimer);
    touchTimer = setTimeout(() => {
      setTooltipText(label);
      setIsMobileTooltipActive(true);
    }, 450);
  };
  const handleToolTouchEnd = () => {
    clearTimeout(touchTimer);
    setIsMobileTooltipActive(false);
  };

  // Desktop hover handled via CSS :hover pseudo, but we also want an accessible tooltip area
  // We'll show a small floating tooltip for keyboard/focus as well
  const showTransientTooltip = (text) => {
    setTooltipText(text);
    setIsMobileTooltipActive(true);
    setTimeout(() => setIsMobileTooltipActive(false), 900);
  };

  // ----------------------------
  // UI Render helpers
  // ----------------------------
  const ToolButton = ({ label, icon, active, onClick }) => {
    return (
      <div
        className={`tb-item ${active ? "active" : ""}`}
        onMouseEnter={() => { setTooltipText(label); }}
        onMouseLeave={() => { setTooltipText(""); }}
        onFocus={() => setTooltipText(label)}
        onBlur={() => setTooltipText("")}
        onTouchStart={() => handleToolTouchStart(label)}
        onTouchEnd={() => handleToolTouchEnd()}
        style={{ display: "inline-flex", alignItems: "center" }}
      >
        <button
          className={`tool-btn ${active ? "tool-active" : ""}`}
          onClick={onClick}
          title={label}
          aria-label={label}
        >
          <span style={{fontSize: 16}}>{icon}</span>
        </button>
      </div>
    );
  };

  // ----------------------------
  // JSX
  // ----------------------------
  return (
    <div className={`wb-root ${darkMode ? "wb-dark" : "wb-light"}`} style={{ minHeight: "100vh", padding: 14 }}>
      <div className="wb-container" ref={containerRef} style={{ maxWidth: 1200, margin: "0 auto" }}>
        {/* Header */}
        <header className="wb-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22 }}>🎨 AI Whiteboard</h1>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>User: <strong>{username}</strong></div>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button
                className="simple-btn"
                onClick={() => { setDarkMode(d => !d); showTransientTooltip(darkMode ? "Switch to light" : "Switch to dark"); }}
              >
                {darkMode ? "☀️" : "🌙"}
              </button>

              <button
                className="simple-btn"
                onClick={() => {
                  // quick clear canvas
                  if (!confirm("Clear board? This action cannot be undone.")) return;
                  const c = canvasRef.current;
                  const ctx = ctxRef.current;
                  ctx.clearRect(0,0,c.width,c.height);
                  ctx.fillStyle = "#ffffff";
                  ctx.fillRect(0,0,c.width,c.height);
                  setHistory([c.toDataURL()]);
                  setRedoStack([]);
                  setSelectedDiagramId(null);
                }}
              >
                🧹 Clear
              </button>

              <button
                className="simple-btn"
                onClick={() => {
                  onLogout();
                }}
              >
                🚪 Logout
              </button>
            </div>
          </div>
        </header>

        {/* Top toolbar: color, brush size, tool icons */}
        <section className="wb-toolbar" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            {/* Color picker scaled down */}
            <div style={{ transform: "scale(0.72)", transformOrigin: "top left", borderRadius: 8, overflow: "hidden" }}>
              <ChromePicker color={color} onChange={c => setColor(c.hex)} disableAlpha={true} />
            </div>

            {/* Brush size */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <label style={{ fontSize: 12, marginBottom: 6 }}>Brush</label>
              <input
                title="Brush size"
                type="range"
                min="1"
                max="40"
                value={brushSize}
                onChange={e => setBrushSize(parseInt(e.target.value, 10))}
                style={{ width: 96 }}
              />
            </div>

            {/* Tools group */}
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <ToolButton label="Brush" icon="🖌️" active={tool === "brush"} onClick={() => setTool("brush")} />
              <ToolButton label="Eraser" icon="🧽" active={tool === "eraser"} onClick={() => setTool("eraser")} />
              <ToolButton label="Line" icon="📏" active={tool === "line"} onClick={() => setTool("line")} />
              <ToolButton label="Rectangle" icon="▭" active={tool === "rect"} onClick={() => setTool("rect")} />
              <ToolButton label="Circle" icon="◯" active={tool === "circle"} onClick={() => setTool("circle")} />
              <ToolButton label="XY Grid" icon="📐" active={showGrid} onClick={() => setShowGrid(g => !g)} />
            </div>
          </div>

          {/* Right-side smaller actions */}
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <ToolButton label="Undo" icon="↶" onClick={undo} />
            <ToolButton label="Redo" icon="↷" onClick={redo} />
            <ToolButton label="Export PNG" icon="💾" onClick={() => { exportPNG(); showTransientTooltip("Export PNG"); }} />
            <ToolButton label="Export PDF" icon="📄" onClick={() => { exportPDF(); showTransientTooltip("Export PDF"); }} />
            <button
              className="primary-btn"
              onClick={() => saveDiagram({ overwriteId: selectedDiagramId })}
              disabled={isSaving}
              onMouseEnter={() => setTooltipText(selectedDiagramId ? "Update save" : "Save new diagram")}
              onMouseLeave={() => setTooltipText("")}
              onTouchStart={() => handleToolTouchStart(selectedDiagramId ? "Update save" : "Save new")}
              onTouchEnd={() => handleToolTouchEnd()}
            >
              {isSaving ? "Saving..." : (selectedDiagramId ? "Update" : "Save")}
            </button>
          </div>
        </section>

        {/* Canvas + title + responsive layout */}
        <section className="wb-board-area" style={{ marginTop: 12 }}>
          {/* Title input and save-as-new controls */}
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
            <input
              value={titleInput}
              onChange={e => setTitleInput(e.target.value)}
              placeholder="Diagram title (optional)"
              style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid var(--muted)", minWidth: 220 }}
            />
            <button className="ghost-btn" onClick={() => { setTitleInput(""); setSelectedDiagramId(null); showTransientTooltip("Start new diagram"); }}>New</button>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>
              {selectedDiagramId ? `Editing: #${selectedDiagramId}` : "New diagram"}
            </div>
          </div>

          {/* Canvas container */}
          <div style={{ display: "flex", justifyContent: "center" }}>
            <canvas
              ref={canvasRef}
              style={{
                borderRadius: 10,
                boxShadow: "0 10px 30px rgba(0,0,0,0.12)",
                touchAction: "none",
                width: canvasWidth,
                height: canvasHeight,
                maxWidth: "100%",
                background: darkMode ? "#0b1220" : "#fff"
              }}
              onMouseDown={handlePointerDown}
              onMouseMove={handlePointerMove}
              onMouseUp={handlePointerUp}
              onMouseLeave={handlePointerUp}
              onTouchStart={handlePointerDown}
              onTouchMove={handlePointerMove}
              onTouchEnd={handlePointerUp}
            />
          </div>
        </section>

        {/* Gallery */}
        <section style={{ marginTop: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <h3 style={{ margin: 0 }}>📚 Gallery</h3>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="ghost-btn" onClick={fetchGallery}>Refresh</button>
              <button className="ghost-btn" onClick={() => { setSavedDiagrams([]); fetchGallery(); }}>Reload</button>
            </div>
          </div>

          <div className="gallery-grid" style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {savedDiagrams.length === 0 && <div style={{ color: "var(--muted)" }}>No saved diagrams yet.</div>}
            {savedDiagrams.map(item => (
              <div key={item.id} className="gallery-card" style={{ width: 170, borderRadius: 8, overflow: "hidden", background: "var(--card-bg)", boxShadow: "0 8px 20px rgba(0,0,0,0.08)" }}>
                <div style={{ padding: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{item.title || `#${item.id}`}</div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      className="icon-small"
                      onClick={() => {
                        const newTitle = prompt("Rename diagram", item.title || "");
                        if (newTitle !== null && newTitle !== item.title) renameDiagram(item.id, newTitle);
                      }}
                      title="Rename"
                    >
                      ✏️
                    </button>
                    <button className="icon-small" onClick={() => deleteDiagram(item.id)} title="Delete">🗑️</button>
                  </div>
                </div>
                <div style={{ cursor: "pointer" }} onClick={() => loadDiagramToCanvas(item)}>
                  <img src={item.content} alt={item.title || `diagram-${item.id}`} style={{ width: "100%", height: 110, objectFit: "cover", display: "block" }} />
                </div>
                <div style={{ display: "flex", gap: 6, padding: 8, justifyContent: "space-between" }}>
                  <button className="ghost-btn" onClick={() => { loadDiagramToCanvas(item); showTransientTooltip("Load for editing"); }}>Load</button>
                  <button className="ghost-btn" onClick={() => { saveDiagram({ overwriteId: item.id }); showTransientTooltip("Overwrite this diagram"); }}>Save</button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Floating tooltip for mobile (and transient desktop) */}
        <div className={`floating-tooltip ${isMobileTooltipActive || tooltipText ? "visible" : ""}`} style={{ position: "fixed", right: 20, bottom: 24 }}>
          <div style={{ background: "rgba(0,0,0,0.8)", color: "#fff", padding: "6px 10px", borderRadius: 8, fontSize: 13 }}>
            {isMobileTooltipActive ? tooltipText : (tooltipText || "")}
          </div>
        </div>
      </div>

      {/* Inline styles + simple CSS-in-JS for animations */}
      <style>{`
        :root {
          --muted: #6b7280;
          --card-bg: #ffffff;
        }
        .wb-dark { --muted: #9ca3af; --card-bg: #071224; color: #e6eef9; }
        .wb-light { --muted: #6b7280; --card-bg: #fff; color: #111827; }
        .tool-btn {
          background: var(--card-bg);
          border: 1px solid rgba(0,0,0,0.06);
          padding: 8px;
          border-radius: 8px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 42px;
          min-height: 36px;
          transition: transform 0.12s ease, box-shadow 0.12s ease;
          font-weight: 600;
        }
        .tool-btn:hover { transform: translateY(-4px); box-shadow: 0 8px 18px rgba(0,0,0,0.12); }
        .tool-active { background: #111827; color: white; }
        .primary-btn {
          padding: 8px 12px;
          background: linear-gradient(90deg,#06b6d4,#06b6d4);
          color: white;
          border-radius: 8px;
          border: none;
          cursor: pointer;
          font-weight: 700;
          box-shadow: 0 8px 18px rgba(6,182,212,0.14);
        }
        .primary-btn[disabled] { opacity: 0.6; cursor: not-allowed; }
        .ghost-btn {
          padding: 6px 8px; background: transparent; border: 1px solid rgba(0,0,0,0.06); border-radius: 8px; cursor: pointer;
        }
        .simple-btn { padding: 6px 8px; border-radius: 6px; background: rgba(0,0,0,0.04); border: none; cursor: pointer; }
        .icon-small { padding: 6px; border-radius: 6px; background: rgba(0,0,0,0.03); border: none; cursor: pointer; }

        /* gallery card */
        .gallery-card { transition: transform 0.12s ease, box-shadow 0.12s ease; }
        .gallery-card:hover { transform: translateY(-6px); box-shadow: 0 14px 34px rgba(0,0,0,0.12); }

        /* responsive toolbar stacking on mobile */
        @media (max-width: 820px) {
          .wb-toolbar { flex-direction: column; align-items: stretch; gap: 12px; }
          .tool-btn { min-width: 36px; min-height: 34px; padding: 6px; }
          .primary-btn { width: 100%; }
        }

        .floating-tooltip { opacity: 0; transform: translateY(6px); transition: opacity 180ms, transform 180ms; pointer-events: none; }
        .floating-tooltip.visible { opacity: 1; transform: translateY(0); pointer-events: auto; }

      `}</style>
    </div>
  );
}
