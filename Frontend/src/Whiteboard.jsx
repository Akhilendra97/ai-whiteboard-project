import React, { useRef, useState, useEffect } from "react";
import API_URL from "./config";
import { ChromePicker } from "react-color";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

/* Whiteboard component:
  - Brush, Eraser, Shapes (line, rect, circle)
  - Undo/Redo (snapshot history)
  - Save/Load diagrams to backend
  - Gallery with thumbnails, rename, delete, load
  - Export PNG and PDF
  - Mobile touch support
*/

export default function Whiteboard({ onLogout }) {
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);

  // state
  const [color, setColor] = useState("#000000");
  const [brushSize, setBrushSize] = useState(4);
  const [tool, setTool] = useState("brush"); // brush, eraser, line, rect, circle
  const [history, setHistory] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const [gallery, setGallery] = useState([]);
  const [selected, setSelected] = useState(null); // selected diagram object
  const [title, setTitle] = useState("");
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState(null);
  const [showGrid, setShowGrid] = useState(false);

  const username = localStorage.getItem("username") || "";

  useEffect(() => {
    const canvas = canvasRef.current;
    canvas.width = Math.min(window.innerWidth - 40, 1100);
    canvas.height = Math.min(window.innerHeight - 260, 760);
    const ctx = canvas.getContext("2d");
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctxRef.current = ctx;
    setHistory([canvas.toDataURL()]);
    loadGallery();
    // eslint-disable-next-line
  }, []);

  // drawing helpers
  const getPointer = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    if (e.touches && e.touches[0]) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    return { x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY };
  };

  const start = (e) => {
    const p = getPointer(e);
    const ctx = ctxRef.current;
    if (!ctx) return;
    if (tool === "brush" || tool === "eraser") {
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.strokeStyle = tool === "eraser" ? "#fff" : color;
      ctx.lineWidth = brushSize;
      ctx.globalCompositeOperation = tool === "eraser" ? "destination-out" : "source-over";
      setIsDrawing(true);
    } else {
      setStartPos(p);
      // push snapshot for preview
      setHistory(prev => {
        const snap = canvasRef.current.toDataURL();
        return [...prev, snap];
      });
    }
  };

  const move = (e) => {
    if (!isDrawing && !startPos) return;
    const p = getPointer(e);
    const ctx = ctxRef.current;
    if (!ctx) return;
    if (tool === "brush" || tool === "eraser") {
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    } else {
      // preview: restore last snapshot then draw shape overlay
      const last = history[history.length - 1];
      const img = new Image();
      img.src = last;
      img.onload = () => {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        ctx.drawImage(img, 0, 0, canvasRef.current.width, canvasRef.current.height);
        if (showGrid) drawGrid(ctx);
        ctx.save();
        ctx.setLineDash([6, 4]);
        ctx.strokeStyle = color;
        ctx.lineWidth = brushSize;
        if (tool === "line" && startPos) {
          ctx.beginPath();
          ctx.moveTo(startPos.x, startPos.y);
          ctx.lineTo(p.x, p.y);
          ctx.stroke();
        } else if (tool === "rect" && startPos) {
          ctx.strokeRect(startPos.x, startPos.y, p.x - startPos.x, p.y - startPos.y);
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
    }
  };

  const end = (e) => {
    const p = getPointer(e || {});
    const ctx = ctxRef.current;
    if (!ctx) return;
    if (tool === "brush" || tool === "eraser") {
      ctx.closePath();
      ctx.globalCompositeOperation = "source-over";
      setIsDrawing(false);
      pushHistory();
    } else if (startPos) {
      // finalize shape
      const last = history[history.length - 1];
      const img = new Image();
      img.src = last;
      img.onload = () => {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        ctx.drawImage(img, 0, 0, canvasRef.current.width, canvasRef.current.height);
        if (showGrid) drawGrid(ctx);
        ctx.save();
        ctx.setLineDash([]);
        ctx.strokeStyle = color;
        ctx.lineWidth = brushSize;
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
    }
  };

  function drawGrid(ctx) {
    const step = 25;
    ctx.save();
    ctx.strokeStyle = "rgba(0,0,0,0.06)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= canvasRef.current.width; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvasRef.current.height);
      ctx.stroke();
    }
    for (let y = 0; y <= canvasRef.current.height; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvasRef.current.width, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  function pushHistory() {
    const snap = canvasRef.current.toDataURL();
    setHistory(prev => {
      const n = [...prev, snap];
      if (n.length > 60) n.shift();
      return n;
    });
    setRedoStack([]);
  }

  function undo() {
    setHistory(prev => {
      if (prev.length <= 1) return prev;
      const last = prev[prev.length - 1];
      setRedoStack(r => [last, ...r]);
      const next = prev.slice(0, -1);
      const img = new Image();
      img.src = next[next.length - 1] || "";
      img.onload = () => {
        ctxRef.current.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        if (next.length) ctxRef.current.drawImage(img, 0, 0, canvasRef.current.width, canvasRef.current.height);
        else {
          ctxRef.current.fillStyle = "#fff";
          ctxRef.current.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        }
        if (showGrid) drawGrid(ctxRef.current);
      };
      return next;
    });
  }

  function redo() {
    setRedoStack(prev => {
      if (prev.length === 0) return prev;
      const [first, ...rest] = prev;
      setHistory(h => [...h, first]);
      const img = new Image();
      img.src = first;
      img.onload = () => {
        ctxRef.current.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        ctxRef.current.drawImage(img, 0, 0, canvasRef.current.width, canvasRef.current.height);
        if (showGrid) drawGrid(ctxRef.current);
      };
      return rest;
    });
  }

  // Gallery backend calls
  async function saveDiagram(overwriteId = null) {
    if (!username) { alert("Login required"); return; }
    const payload = {
      username,
      title: title || `Diagram ${new Date().toLocaleString()}`,
      content: canvasRef.current.toDataURL()
    };
    if (overwriteId) payload.id = overwriteId;
    try {
      const res = await fetch(`${API_URL}/save_diagram`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) { alert(data.detail || data.msg || "Save failed"); return; }
      await loadGallery();
      alert("Saved");
    } catch (err) {
      alert("Network error");
      console.error(err);
    }
  }

  async function loadGallery() {
    if (!username) return;
    try {
      const res = await fetch(`${API_URL}/get_diagrams/${encodeURIComponent(username)}`);
      const arr = await res.json();
      setGallery(arr || []);
    } catch (err) { console.error(err); }
  }

  async function deleteDiagram(id) {
    if (!confirm("Delete this diagram?")) return;
    try {
      const res = await fetch(`${API_URL}/delete_diagram/${id}`, { method: "DELETE" });
      if (!res.ok) { alert("Delete failed"); return; }
      await loadGallery();
    } catch (err) { console.error(err); alert("Network error"); }
  }

  async function renameDiagram(id) {
    const newTitle = prompt("New title:");
    if (!newTitle) return;
    try {
      const res = await fetch(`${API_URL}/rename_diagram/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle })
      });
      if (!res.ok) { alert("Rename failed"); return; }
      await loadGallery();
    } catch (err) { console.error(err); alert("Network error"); }
  }

  // export
  function exportPNG() {
    const link = document.createElement("a");
    link.download = `diagram-${Date.now()}.png`;
    link.href = canvasRef.current.toDataURL();
    link.click();
  }

  async function exportPDF() {
    try {
      const canvas = canvasRef.current;
      const rendered = await html2canvas(canvas, { useCORS: true, scale: 2 });
      const imgData = rendered.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: canvas.width > canvas.height ? "landscape" : "portrait",
        unit: "px",
        format: [rendered.width, rendered.height]
      });
      pdf.addImage(imgData, "PNG", 0, 0, rendered.width, rendered.height);
      pdf.save(`diagram-${Date.now()}.pdf`);
    } catch (err) { console.error(err); alert("Export failed"); }
  }

  // load diagram onto canvas
  function loadToCanvas(item) {
    const img = new Image();
    img.src = item.content;
    img.onload = () => {
      ctxRef.current.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      ctxRef.current.drawImage(img, 0, 0, canvasRef.current.width, canvasRef.current.height);
      if (showGrid) drawGrid(ctxRef.current);
      setHistory([canvasRef.current.toDataURL()]);
      setSelected(item);
      setTitle(item.title || "");
    };
  }

  return (
    <div className="whiteboard-root">
      <div className="wb-header">
        <div>
          <h2>🎨 AI Whiteboard</h2>
          <div className="muted">User: <strong>{username || "guest"}</strong></div>
        </div>
        <div className="wb-actions">
          <button onClick={() => { setShowGrid(g => !g); }}>Grid</button>
          <button onClick={() => { ctxRef.current && ctxRef.current.clearRect(0,0,canvasRef.current.width,canvasRef.current.height); ctxRef.current.fillStyle="#fff"; ctxRef.current.fillRect(0,0,canvasRef.current.width,canvasRef.current.height); setHistory([canvasRef.current.toDataURL()]); }}>Clear</button>
          <button onClick={() => { localStorage.removeItem("username"); localStorage.removeItem("token"); onLogout(); }}>Logout</button>
        </div>
      </div>

      <div className="wb-toolbar">
        <div className="tool-block">
          <div className="tool-buttons">
            <button className={tool==="brush" ? "active" : ""} onClick={() => setTool("brush")}>🖌️</button>
            <button className={tool==="eraser" ? "active" : ""} onClick={() => setTool("eraser")}>🧽</button>
            <button className={tool==="line" ? "active" : ""} onClick={() => setTool("line")}>📏</button>
            <button className={tool==="rect" ? "active" : ""} onClick={() => setTool("rect")}>▭</button>
            <button className={tool==="circle" ? "active" : ""} onClick={() => setTool("circle")}>◯</button>
          </div>
          <div className="color-picker">
            <ChromePicker color={color} onChange={c => setColor(c.hex)} disableAlpha />
          </div>
          <div>
            <label>Size</label>
            <input type="range" min="1" max="40" value={brushSize} onChange={e => setBrushSize(parseInt(e.target.value,10))} />
          </div>
        </div>

        <div className="action-block">
          <button onClick={undo}>Undo</button>
          <button onClick={redo}>Redo</button>
          <button onClick={exportPNG}>PNG</button>
          <button onClick={exportPDF}>PDF</button>
          <button onClick={() => saveDiagram(selected ? selected.id : null)}>{selected ? "Update" : "Save"}</button>
        </div>
      </div>

      <div className="canvas-wrap">
        <canvas
          ref={canvasRef}
          onMouseDown={start}
          onMouseMove={move}
          onMouseUp={end}
          onMouseLeave={end}
          onTouchStart={start}
          onTouchMove={move}
          onTouchEnd={end}
        />
      </div>

      <div className="gallery">
        <h3>Gallery</h3>
        <div className="gallery-grid">
          {gallery.map(g => (
            <div className="thumb" key={g.id}>
              <img src={g.content} alt={g.title} onClick={() => loadToCanvas(g)} />
              <div className="thumb-meta">
                <div className="title">{g.title}</div>
                <div className="thumb-actions">
                  <button onClick={() => renameDiagram(g.id)}>✏️</button>
                  <button onClick={() => deleteDiagram(g.id)}>🗑️</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        .whiteboard-root { padding: 14px; font-family: Inter, system-ui, Arial; }
        .wb-header { display:flex; justify-content:space-between; align-items:center; }
        .wb-actions button { margin-left:8px; }
        .wb-toolbar { display:flex; gap:12px; margin-top:10px; flex-wrap:wrap; }
        .tool-block { display:flex; gap:12px; align-items:center; }
        .tool-buttons button { margin-right:6px; padding:8px; border-radius:6px; }
        .tool-buttons .active { background:#111; color:#fff; }
        .canvas-wrap { margin-top:16px; display:flex; justify-content:center; }
        canvas { border: 3px solid #222; border-radius:8px; max-width:100%; touch-action:none; }
        .gallery { margin-top:18px; }
        .gallery-grid { display:flex; gap:10px; flex-wrap:wrap; }
        .thumb { width:190px; border:1px solid #ddd; border-radius:8px; overflow:hidden; background:#fff; }
        .thumb img { width:100%; height:120px; object-fit:cover; cursor:pointer; }
        .thumb-meta { padding:8px; display:flex; justify-content:space-between; align-items:center; }
        .thumb-actions button { margin-left:6px; }
        .muted { color: #6b7280; font-size:12px; }
      `}</style>
    </div>
  );
}
