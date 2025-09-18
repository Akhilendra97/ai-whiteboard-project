// Frontend/src/Whiteboard.jsx
//
// Comprehensive Whiteboard component
// Features included:
// - Brush, Eraser
// - Shapes: Line, Rectangle, Circle, Freehand
// - Grid overlay (XY graph paper)
// - Undo / Redo (snapshot-based)
// - Save to backend (create & update) and Gallery (thumbnails, load, rename, delete)
// - Export PNG and Export PDF
// - Mobile-friendly (touch support, stacked toolbar)
// - Tooltips: hover for desktop, tap-hold for mobile
// - Dark/Light theme toggle
// - Compact responsive UI
// - Uses API URL from ./config.js (so same-origin or VITE_API_URL are supported)
//
// Requirements (install in your frontend):
// npm install react-color html2canvas jspdf
//
// Assumptions about backend endpoints (matching the SQLite-only backend we finalized):
// POST   /save_diagram         body: { username, title, content, id? } -> returns JSON
// GET    /get_diagrams/{username}                          -> returns [{ id, title, content }, ...]
// DELETE /delete_diagram/{id}                              -> returns JSON
// PUT    /rename_diagram/{id}     body: { title }          -> returns JSON
//
// The component expects to use localStorage for authentication (username/token).
// - localStorage.getItem("username") -> username string
// - localStorage.getItem("token") might exist (but this component will work without token)
//
// NOTE: keep API_ROOT in config.js as "" for same-origin deployments (recommended on Railway).

import React, { useRef, useState, useEffect, useCallback } from "react";
import API_URL from "./config"; // expected to export "" or a base URL
import { ChromePicker } from "react-color";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

/* eslint-disable react-hooks/exhaustive-deps */
/* Large, single-file whiteboard. Split into sections:
   1) Constants & utilities
   2) Canvas lifecycle & drawing primitives
   3) Shapes preview & commit
   4) Undo/redo history
   5) Gallery & backend calls
   6) Export functions (PNG/PDF)
   7) Tooltips + mobile tap-hold
   8) UI render
*/

// ------------------------------
// 1) Constants & Utilities
// ------------------------------
const MAX_HISTORY = 80; // keep snapshot history bounded
const GRID_STEP_DEFAULT = 25;

function dataURLToImage(dataURL) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataURL;
  });
}

function safeFetch(url, options = {}) {
  // helper to always attempt fetch and parse JSON when possible
  return fetch(url, options).then(async (res) => {
    const text = await res.text().catch(() => "");
    try {
      const json = text ? JSON.parse(text) : {};
      return { ok: res.ok, status: res.status, data: json, text };
    } catch {
      // not JSON
      return { ok: res.ok, status: res.status, data: null, text };
    }
  });
}

// ------------------------------
// 2) Component
// ------------------------------
export default function Whiteboard({ onLogout }) {
  // Refs
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const ctxRef = useRef(null);

  // Canvas size responsive
  const [canvasWidth, setCanvasWidth] = useState(1000);
  const [canvasHeight, setCanvasHeight] = useState(560);

  // Drawing state
  const [tool, setTool] = useState("brush"); // brush, eraser, line, rect, circle, highlighter
  const [color, setColor] = useState("#000000");
  const [brushSize, setBrushSize] = useState(4);
  const [highlighterOpacity, setHighlighterOpacity] = useState(0.25);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState(null); // shape start
  const [showGrid, setShowGrid] = useState(false);
  const [gridStep, setGridStep] = useState(GRID_STEP_DEFAULT);
  const [darkMode, setDarkMode] = useState(false);

  // History
  const [history, setHistory] = useState([]); // urls
  const [redoStack, setRedoStack] = useState([]);

  // Gallery & backend
  const [gallery, setGallery] = useState([]); // [{id, title, content}, ...]
  const [selectedDiagram, setSelectedDiagram] = useState(null); // {id, title, content}
  const [titleInput, setTitleInput] = useState("");

  // UI
  const [tooltip, setTooltip] = useState("");
  const [mobileTooltipActive, setMobileTooltipActive] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);

  // User
  const localUsername = localStorage.getItem("username") || "";
  const apiToken = localStorage.getItem("token") || null;

  // ------------------------------
  // Setup canvas and responsive size
  // ------------------------------
  const computeSize = useCallback(() => {
    // container-based sizing: try to limit to 1000px width for desktop
    const pad = 48;
    const maxW = Math.min(window.innerWidth - pad, 1100);
    const maxH = Math.min(window.innerHeight - 300, 900);
    setCanvasWidth(maxW);
    setCanvasHeight(maxH);
  }, []);

  useEffect(() => {
    computeSize();
    window.addEventListener("resize", computeSize);
    return () => window.removeEventListener("resize", computeSize);
  }, [computeSize]);

  useEffect(() => {
    // initialize canvas with size
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    const ctx = canvas.getContext("2d");
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctxRef.current = ctx;

    // push initial blank snapshot
    const initial = canvas.toDataURL();
    setHistory([initial]);
    setRedoStack([]);

    // load gallery
    if (localUsername) {
      fetchGallery();
    }
  }, [canvasWidth, canvasHeight]);

  // ------------------------------
  // draw grid overlay
  // ------------------------------
  const drawGrid = useCallback(
    (ctx) => {
      if (!showGrid) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      ctx.save();
      ctx.lineWidth = 1;
      ctx.strokeStyle = darkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.06)";
      ctx.beginPath();
      for (let x = 0; x <= canvas.width; x += gridStep) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
      }
      for (let y = 0; y <= canvas.height; y += gridStep) {
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
      }
      ctx.stroke();
      ctx.restore();
    },
    [gridStep, showGrid, darkMode]
  );

  // ------------------------------
  // History helpers
  // ------------------------------
  const pushHistory = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const data = canvas.toDataURL("image/png");
    setHistory((prev) => {
      const next = [...prev, data];
      if (next.length > MAX_HISTORY) next.shift();
      return next;
    });
    setRedoStack([]);
  }, []);

  const undo = () => {
    setHistory((prev) => {
      if (prev.length <= 1) {
        // clear to blank
        const c = canvasRef.current;
        const ctx = ctxRef.current;
        if (ctx) {
          ctx.clearRect(0, 0, c.width, c.height);
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, c.width, c.height);
        }
        return [c.toDataURL()];
      }
      // move top to redo
      const last = prev[prev.length - 1];
      setRedoStack((r) => [last, ...r]);
      const next = prev.slice(0, -1);
      const img = new Image();
      img.src = next[next.length - 1] || "";
      img.onload = () => {
        const ctx = ctxRef.current;
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        if (next.length) ctx.drawImage(img, 0, 0, canvasRef.current.width, canvasRef.current.height);
        else {
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        }
        drawGrid(ctx);
      };
      return next;
    });
  };

  const redo = () => {
    setRedoStack((prev) => {
      if (prev.length === 0) return prev;
      const [first, ...rest] = prev;
      setHistory((h) => {
        const next = [...h, first];
        const img = new Image();
        img.src = first;
        img.onload = () => {
          const ctx = ctxRef.current;
          ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
          ctx.drawImage(img, 0, 0, canvasRef.current.width, canvasRef.current.height);
          drawGrid(ctx);
        };
        return next;
      });
      return rest;
    });
  };

  // ------------------------------
  // Pointer event helpers (touch + mouse)
  // ------------------------------
  const getPointer = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    if (e.touches && e.touches[0]) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    if (e.nativeEvent && typeof e.nativeEvent.offsetX === "number") {
      return { x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY };
    }
    // fallback
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handlePointerDown = (e) => {
    e.preventDefault();
    const p = getPointer(e);
    const ctx = ctxRef.current;
    if (!ctx) return;

    if (tool === "brush" || tool === "eraser" || tool === "highlighter") {
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineWidth = tool === "highlighter" ? brushSize * 3 : brushSize;
      if (tool === "eraser") {
        ctx.globalCompositeOperation = "destination-out";
        ctx.strokeStyle = "rgba(0,0,0,1)";
      } else {
        ctx.globalCompositeOperation = "source-over";
        if (tool === "highlighter") {
          // use RGBA based on color and opacity
          ctx.strokeStyle = hexToRgba(color, highlighterOpacity);
        } else {
          ctx.strokeStyle = color;
        }
      }
      setIsDrawing(true);
    } else {
      // shape tools: record start position; push snapshot for preview
      setStartPos(p);
      pushHistory(); // so preview can restore previous snapshot
    }
  };

  const handlePointerMove = (e) => {
    if (!isDrawing && !startPos) return;
    e.preventDefault();
    const p = getPointer(e);
    const ctx = ctxRef.current;
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;

    // shape preview mode: restore last snapshot and draw preview shape
    if (tool === "line" || tool === "rect" || tool === "circle") {
      const last = history[history.length - 1] || canvas.toDataURL();
      const img = new Image();
      img.src = last;
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        drawGrid(ctx);
        // draw preview
        ctx.save();
        ctx.setLineDash([6, 6]);
        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(1, brushSize);
        if (tool === "line" && startPos) {
          ctx.beginPath();
          ctx.moveTo(startPos.x, startPos.y);
          ctx.lineTo(p.x, p.y);
          ctx.stroke();
        } else if (tool === "rect" && startPos) {
          const w = p.x - startPos.x;
          const h = p.y - startPos.y;
          ctx.strokeRect(startPos.x, startPos.y, w, h);
        } else if (tool === "circle" && startPos) {
          const dx = p.x - startPos.x;
          const dy = p.y - startPos.y;
          const r = Math.sqrt(dx * dx + dy * dy);
          ctx.beginPath();
          ctx.arc(startPos.x, startPos.y, r, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
      };
      return;
    }

    // freehand drawing
    if (isDrawing) {
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }
  };

  const handlePointerUp = (e) => {
    e?.preventDefault();
    const p = getPointer(e || {});
    const ctx = ctxRef.current;
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;

    if (tool === "brush" || tool === "eraser" || tool === "highlighter") {
      ctx.closePath();
      ctx.globalCompositeOperation = "source-over";
      setIsDrawing(false);
      pushHistory();
    } else if (startPos) {
      // finalize shape by drawing on top of last snapshot
      const last = history[history.length - 1] || canvas.toDataURL();
      const img = new Image();
      img.src = last;
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        drawGrid(ctx);
        ctx.save();
        ctx.setLineDash([]);
        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(1, brushSize);
        if (tool === "line") {
          ctx.beginPath();
          ctx.moveTo(startPos.x, startPos.y);
          ctx.lineTo(p.x, p.y);
          ctx.stroke();
        } else if (tool === "rect") {
          ctx.strokeRect(startPos.x, startPos.y, p.x - startPos.x, p.y - startPos.y);
        } else if (tool === "circle") {
          const dx = p.x - startPos.x;
          const dy = p.y - startPos.y;
          const r = Math.sqrt(dx * dx + dy * dy);
          ctx.beginPath();
          ctx.arc(startPos.x, startPos.y, r, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
        pushHistory();
        setStartPos(null);
      };
    } else {
      // nothing special
      setStartPos(null);
      setIsDrawing(false);
    }
  };

  // helper to convert hex to rgba string
  function hexToRgba(hex, alpha = 1) {
    // remove #
    const h = hex.replace("#", "");
    const bigint = parseInt(h, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  // ------------------------------
  // 5) Gallery & backend calls
  // ------------------------------
  async function fetchGallery() {
    if (!localUsername) return;
    try {
      const url = `${API_URL}/get_diagrams/${encodeURIComponent(localUsername)}`;
      const res = await safeFetch(url, { headers: apiToken ? { Authorization: `Bearer ${apiToken}` } : {} });
      if (!res.ok) {
        console.error("Failed to fetch gallery", res.status, res.text);
        return;
      }
      // Normalize fields to { id, title, content }
      const arr = (res.data && Array.isArray(res.data)) ? res.data : [];
      const normalized = arr.map((it) => {
        return {
          id: it.id || it.diagram_id || it.id,
          title: it.title || it.name || `Diagram ${it.id}`,
          content: it.content || it.image || it.img || it.data || it.content,
        };
      });
      setGallery(normalized);
    } catch (err) {
      console.error("fetchGallery error", err);
    }
  }

  useEffect(() => {
    if (localUsername) fetchGallery();
  }, []);

  async function saveDiagram({ overwriteId = null } = {}) {
    if (!localUsername) {
      alert("Please login/register to save diagrams.");
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;

    setSaving(true);
    try {
      const content = canvas.toDataURL("image/png");
      const payload = {
        username: localUsername,
        title: titleInput || (selectedDiagram ? selectedDiagram.title : `Diagram ${new Date().toLocaleString()}`),
        content,
      };
      if (overwriteId) payload.id = overwriteId;

      const url = `${API_URL}/save_diagram`;
      const res = await safeFetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(apiToken ? { Authorization: `Bearer ${apiToken}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        console.error("Save failed", res.status, res.text);
        alert(res.text || "Save failed");
      } else {
        // refresh gallery and set selected
        await fetchGallery();
        if (res.data && res.data.id) {
          setSelectedDiagram({ id: res.data.id, title: payload.title, content });
        }
        alert("Saved");
      }
    } catch (err) {
      console.error("saveDiagram error", err);
      alert("Network error while saving diagram");
    } finally {
      setSaving(false);
    }
  }

  async function deleteDiagram(id) {
    if (!confirm("Delete this diagram permanently?")) return;
    try {
      const url = `${API_URL}/delete_diagram/${id}`;
      const res = await safeFetch(url, {
        method: "DELETE",
        headers: apiToken ? { Authorization: `Bearer ${apiToken}` } : {},
      });
      if (!res.ok) {
        alert("Delete failed");
        console.error("delete failed", res.status, res.text);
      } else {
        await fetchGallery();
        if (selectedDiagram && selectedDiagram.id === id) {
          setSelectedDiagram(null);
          // reset canvas to blank
          const ctx = ctxRef.current;
          const c = canvasRef.current;
          ctx.clearRect(0, 0, c.width, c.height);
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, c.width, c.height);
          setHistory([c.toDataURL()]);
        }
      }
    } catch (err) {
      console.error("delete error", err);
      alert("Network error during delete");
    }
  }

  async function renameDiagram(id) {
    const newTitle = prompt("Enter new title for diagram:");
    if (!newTitle) return;
    try {
      const url = `${API_URL}/rename_diagram/${id}`;
      const res = await safeFetch(url, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(apiToken ? { Authorization: `Bearer ${apiToken}` } : {}),
        },
        body: JSON.stringify({ title: newTitle }),
      });
      if (!res.ok) {
        alert("Rename failed");
      } else {
        await fetchGallery();
      }
    } catch (err) {
      console.error("rename error", err);
      alert("Network error during rename");
    }
  }

  function loadDiagramItem(item) {
    if (!item || !item.content) return;
    const img = new Image();
    img.src = item.content;
    img.onload = async () => {
      const ctx = ctxRef.current;
      const canvas = canvasRef.current;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      drawGrid(ctx);
      setHistory([canvas.toDataURL()]);
      setRedoStack([]);
      setSelectedDiagram(item);
      setTitleInput(item.title || "");
    };
  }

  // ------------------------------
  // 6) Export functions
  // ------------------------------
  function exportPNG() {
    const canvas = canvasRef.current;
    const link = document.createElement("a");
    link.download = `diagram-${Date.now()}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  async function exportPDF() {
    setExporting(true);
    try {
      const canvas = canvasRef.current;
      // use html2canvas for higher-fidelity capture (2x scale)
      const rendered = await html2canvas(canvas, { useCORS: true, scale: 2 });
      const imgData = rendered.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: canvas.width >= canvas.height ? "landscape" : "portrait",
        unit: "px",
        format: [rendered.width, rendered.height],
      });
      pdf.addImage(imgData, "PNG", 0, 0, rendered.width, rendered.height);
      pdf.save(`diagram-${Date.now()}.pdf`);
    } catch (err) {
      console.error("exportPDF error", err);
      alert("Export to PDF failed");
    } finally {
      setExporting(false);
    }
  }

  // ------------------------------
  // 7) Tooltips / mobile tap-hold
  // ------------------------------
  // mobile tap-hold handler
  let touchTimer = null;
  function startTouchTooltip(label) {
    clearTimeout(touchTimer);
    touchTimer = setTimeout(() => {
      setTooltip(label);
      setMobileTooltipActive(true);
    }, 450);
  }
  function cancelTouchTooltip() {
    clearTimeout(touchTimer);
    setMobileTooltipActive(false);
  }

  // small helper to show tooltip briefly on desktop
  function flashTooltip(text) {
    setTooltip(text);
    setTimeout(() => setTooltip(""), 900);
  }

  // ------------------------------
  // 8) UI Render
  // ------------------------------
  // Buttons small style and responsive layout built-in CSS below
  return (
    <div ref={containerRef} className={darkMode ? "wb-root wb-dark" : "wb-root wb-light"} style={{ minHeight: "100vh", padding: 16 }}>
      {/* Header */}
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22 }}>🎨 AI Whiteboard</h1>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>User: <strong>{localUsername || "guest"}</strong></div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            className="small-btn"
            onClick={() => { setDarkMode((d) => !d); flashTooltip(darkMode ? "Light mode" : "Dark mode"); }}
            onMouseEnter={() => setTooltip(darkMode ? "Switch to light" : "Switch to dark")}
            onMouseLeave={() => setTooltip("")}
            onTouchStart={() => startTouchTooltip(darkMode ? "Switch to light" : "Switch to dark")}
            onTouchEnd={cancelTouchTooltip}
          >
            {darkMode ? "☀️" : "🌙"}
          </button>

          <button
            className="small-btn"
            onClick={() => {
              if (!confirm("Clear the board?")) return;
              const ctx = ctxRef.current;
              const c = canvasRef.current;
              ctx.clearRect(0, 0, c.width, c.height);
              ctx.fillStyle = "#ffffff";
              ctx.fillRect(0, 0, c.width, c.height);
              setHistory([c.toDataURL()]);
              setRedoStack([]);
              setSelectedDiagram(null);
              setTitleInput("");
            }}
            onMouseEnter={() => setTooltip("Clear board")}
            onMouseLeave={() => setTooltip("")}
            onTouchStart={() => startTouchTooltip("Clear board")}
            onTouchEnd={cancelTouchTooltip}
          >
            🧹
          </button>

          <button
            className="small-btn"
            onClick={() => {
              onLogout?.();
            }}
            onMouseEnter={() => setTooltip("Logout")}
            onMouseLeave={() => setTooltip("")}
            onTouchStart={() => startTouchTooltip("Logout")}
            onTouchEnd={cancelTouchTooltip}
          >
            🚪 Logout
          </button>
        </div>
      </header>

      {/* Toolbar: left = color/brush/shape; right = actions */}
      <section style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        {/* Left tools */}
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          {/* Color picker */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>Color</div>
            <div style={{ borderRadius: 8, overflow: "hidden" }}>
              <ChromePicker
                color={color}
                onChange={(c) => setColor(c.hex)}
                disableAlpha={true}
              />
            </div>
          </div>

          {/* Brush size */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>Brush</div>
            <input
              type="range"
              min="1"
              max="40"
              value={brushSize}
              onChange={(e) => setBrushSize(parseInt(e.target.value, 10))}
              style={{ width: 120 }}
            />
          </div>

          {/* Tool icons */}
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <div
              className={`tool-item ${tool === "brush" ? "active" : ""}`}
              onMouseEnter={() => setTooltip("Brush")}
              onMouseLeave={() => setTooltip("")}
              onTouchStart={() => startTouchTooltip("Brush")}
              onTouchEnd={cancelTouchTooltip}
            >
              <button className="tool-btn" onClick={() => setTool("brush")}>🖌️</button>
            </div>

            <div
              className={`tool-item ${tool === "eraser" ? "active" : ""}`}
              onMouseEnter={() => setTooltip("Eraser")}
              onMouseLeave={() => setTooltip("")}
              onTouchStart={() => startTouchTooltip("Eraser")}
              onTouchEnd={cancelTouchTooltip}
            >
              <button className="tool-btn" onClick={() => setTool("eraser")}>🧽</button>
            </div>

            <div
              className={`tool-item ${tool === "highlighter" ? "active" : ""}`}
              onMouseEnter={() => setTooltip("Highlighter")}
              onMouseLeave={() => setTooltip("")}
              onTouchStart={() => startTouchTooltip("Highlighter")}
              onTouchEnd={cancelTouchTooltip}
            >
              <button className="tool-btn" onClick={() => setTool("highlighter")}>🖍️</button>
            </div>

            <div
              className={`tool-item ${tool === "line" ? "active" : ""}`}
              onMouseEnter={() => setTooltip("Line")}
              onMouseLeave={() => setTooltip("")}
              onTouchStart={() => startTouchTooltip("Line")}
              onTouchEnd={cancelTouchTooltip}
            >
              <button className="tool-btn" onClick={() => setTool("line")}>📏</button>
            </div>

            <div
              className={`tool-item ${tool === "rect" ? "active" : ""}`}
              onMouseEnter={() => setTooltip("Rectangle")}
              onMouseLeave={() => setTooltip("")}
              onTouchStart={() => startTouchTooltip("Rectangle")}
              onTouchEnd={cancelTouchTooltip}
            >
              <button className="tool-btn" onClick={() => setTool("rect")}>▭</button>
            </div>

            <div
              className={`tool-item ${tool === "circle" ? "active" : ""}`}
              onMouseEnter={() => setTooltip("Circle")}
              onMouseLeave={() => setTooltip("")}
              onTouchStart={() => startTouchTooltip("Circle")}
              onTouchEnd={cancelTouchTooltip}
            >
              <button className="tool-btn" onClick={() => setTool("circle")}>◯</button>
            </div>

            <div
              className={`tool-item ${showGrid ? "active" : ""}`}
              onMouseEnter={() => setTooltip("Toggle Grid")}
              onMouseLeave={() => setTooltip("")}
              onTouchStart={() => startTouchTooltip("Toggle Grid")}
              onTouchEnd={cancelTouchTooltip}
            >
              <button className="tool-btn" onClick={() => { setShowGrid((g) => !g); flashTooltip(showGrid ? "Grid off" : "Grid on"); }}>📐</button>
            </div>
          </div>
        </div>

        {/* Right actions */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button
            className="action-btn"
            onClick={() => { undo(); flashTooltip("Undo"); }}
            onMouseEnter={() => setTooltip("Undo")}
            onMouseLeave={() => setTooltip("")}
            onTouchStart={() => startTouchTooltip("Undo")}
            onTouchEnd={cancelTouchTooltip}
          >
            ↶
          </button>

          <button
            className="action-btn"
            onClick={() => { redo(); flashTooltip("Redo"); }}
            onMouseEnter={() => setTooltip("Redo")}
            onMouseLeave={() => setTooltip("")}
            onTouchStart={() => startTouchTooltip("Redo")}
            onTouchEnd={cancelTouchTooltip}
          >
            ↷
          </button>

          <button
            className="action-btn"
            onClick={() => { exportPNG(); flashTooltip("Export PNG"); }}
            onMouseEnter={() => setTooltip("Export PNG")}
            onMouseLeave={() => setTooltip("")}
            onTouchStart={() => startTouchTooltip("Export PNG")}
            onTouchEnd={cancelTouchTooltip}
          >
            💾
          </button>

          <button
            className="action-btn"
            onClick={() => { exportPDF(); flashTooltip("Export PDF"); }}
            onMouseEnter={() => setTooltip("Export PDF")}
            onMouseLeave={() => setTooltip("")}
            onTouchStart={() => startTouchTooltip("Export PDF")}
            onTouchEnd={cancelTouchTooltip}
          >
            📄
          </button>

          <button
            className="save-btn"
            onClick={() => saveDiagram({ overwriteId: selectedDiagram ? selectedDiagram.id : null })}
            disabled={saving}
            onMouseEnter={() => setTooltip(selectedDiagram ? "Update diagram" : "Save diagram")}
            onMouseLeave={() => setTooltip("")}
            onTouchStart={() => startTouchTooltip(selectedDiagram ? "Update diagram" : "Save diagram")}
            onTouchEnd={cancelTouchTooltip}
          >
            {saving ? "Saving..." : (selectedDiagram ? "Update" : "Save")}
          </button>
        </div>
      </section>

      {/* Title input / small controls */}
      <div style={{ display: "flex", gap: 8, marginTop: 12, alignItems: "center", flexWrap: "wrap" }}>
        <input
          value={titleInput}
          onChange={(e) => setTitleInput(e.target.value)}
          placeholder="Diagram title (optional)"
          style={{ padding: 8, borderRadius: 8, border: "1px solid var(--muted)", minWidth: 260 }}
        />
        <button className="ghost-btn" onClick={() => { setTitleInput(""); setSelectedDiagram(null); flashTooltip("New diagram"); }}>New</button>
        <div style={{ fontSize: 12, color: "var(--muted)" }}>
          {selectedDiagram ? `Editing #${selectedDiagram.id}` : "New diagram"}
        </div>
      </div>

      {/* Canvas container */}
      <div style={{ marginTop: 16, display: "flex", justifyContent: "center" }}>
        <canvas
          ref={canvasRef}
          style={{
            borderRadius: 10,
            boxShadow: "0 10px 30px rgba(0,0,0,0.12)",
            background: darkMode ? "#0b1220" : "#ffffff",
            width: canvasWidth,
            height: canvasHeight,
            touchAction: "none",
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

      {/* Gallery */}
      <section style={{ marginTop: 22 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <h3 style={{ margin: 0 }}>📚 Gallery</h3>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="ghost-btn" onClick={() => fetchGallery()}>Refresh</button>
            <button className="ghost-btn" onClick={() => { setGallery([]); fetchGallery(); }}>Reload</button>
          </div>
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {gallery.length === 0 && <div style={{ color: "var(--muted)" }}>No saved diagrams yet.</div>}
          {gallery.map((g) => (
            <div key={g.id} className="gallery-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{g.title || `#${g.id}`}</div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button className="icon-btn" title="Rename" onClick={() => renameDiagram(g.id)}>✏️</button>
                  <button className="icon-btn" title="Delete" onClick={() => deleteDiagram(g.id)}>🗑️</button>
                </div>
              </div>
              <div style={{ cursor: "pointer" }} onClick={() => loadDiagramItem(g)}>
                <img alt={g.title} src={g.content} style={{ width: 180, height: 120, objectFit: "cover", display: "block" }} />
              </div>
              <div style={{ display: "flex", gap: 6, padding: 8, justifyContent: "space-between" }}>
                <button className="ghost-btn" onClick={() => loadDiagramItem(g)}>Load</button>
                <button className="ghost-btn" onClick={() => saveDiagram({ overwriteId: g.id })}>Overwrite</button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Floating tooltip for mobile and transient desktop */}
      <div className={`floating-tooltip ${mobileTooltipActive || tooltip ? "visible" : ""}`} style={{ position: "fixed", right: 20, bottom: 24 }}>
        <div style={{ background: "rgba(0,0,0,0.8)", color: "#fff", padding: "6px 10px", borderRadius: 8, fontSize: 13 }}>
          {mobileTooltipActive ? tooltip : (tooltip || "")}
        </div>
      </div>

      {/* Inline CSS styles (component scoped) */}
      <style>{`
        :root {
          --muted: #6b7280;
          --card-bg: #ffffff;
          --primary: linear-gradient(90deg,#06b6d4,#3b82f6);
        }
        .wb-dark { --muted: #9ca3af; --card-bg: #071224; color: #e6eef9; background: #071022; }
        .wb-light { --muted: #6b7280; --card-bg: #fff; color: #111827; background: #f6f7fb; }

        .small-btn {
          padding: 6px 8px;
          border-radius: 6px;
          background: rgba(0,0,0,0.04);
          border: none;
          cursor: pointer;
        }

        .tool-btn {
          background: var(--card-bg);
          border: 1px solid rgba(0,0,0,0.06);
          padding: 8px;
          border-radius: 8px;
          cursor: pointer;
          min-width: 42px;
          min-height: 36px;
          transition: transform 0.12s ease, box-shadow 0.12s ease;
          font-weight: 600;
        }
        .tool-btn:hover { transform: translateY(-4px); box-shadow: 0 8px 18px rgba(0,0,0,0.12); }
        .tool-item.active .tool-btn { background: #111827; color: white; }

        .action-btn {
          padding: 8px 10px;
          border-radius: 8px;
          border: none;
          background: rgba(0,0,0,0.06);
          cursor: pointer;
        }

        .save-btn {
          padding: 8px 12px;
          border-radius: 8px;
          border: none;
          background: linear-gradient(90deg,#06b6d4,#3b82f6);
          color: white;
          cursor: pointer;
          font-weight: 700;
        }

        .ghost-btn {
          padding: 6px 8px;
          border-radius: 6px;
          border: 1px solid rgba(0,0,0,0.06);
          background: transparent;
          cursor: pointer;
        }

        .icon-btn {
          background: transparent;
          border: none;
          cursor: pointer;
        }

        .gallery-card {
          width: 200px;
          border-radius: 10px;
          overflow: hidden;
          background: var(--card-bg);
          box-shadow: 0 10px 30px rgba(2,6,23,0.06);
          transition: transform 0.12s ease, box-shadow 0.12s ease;
        }
        .gallery-card:hover { transform: translateY(-6px); box-shadow: 0 18px 40px rgba(2,6,23,0.12); }

        .floating-tooltip { opacity: 0; transform: translateY(6px); transition: opacity 180ms, transform 180ms; pointer-events: none; }
        .floating-tooltip.visible { opacity: 1; transform: translateY(0); pointer-events: auto; }

        @media (max-width: 820px) {
          .wb-root { padding: 10px; }
        }
      `}</style>
    </div>
  );
}

/* End of Whiteboard.jsx */
