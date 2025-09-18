// Frontend/src/Gallery.jsx
import React from "react";

export default function Gallery({ items = [], onLoad, onDelete }) {
  return (
    <div style={{ marginTop: 18 }}>
      <h3 style={{ marginBottom: 8 }}>Saved Diagrams</h3>
      <div style={styles.grid}>
        {items.length === 0 && <p style={{ color: "#666" }}>No saved diagrams yet.</p>}
        {items.map((d) => (
          <div key={d.id} style={styles.card}>
            <img
              src={d.content}
              alt={`d-${d.id}`}
              style={styles.thumb}
              onClick={() => onLoad(d)}
            />
            <div style={{ display: "flex", gap: 6, marginTop: 6, justifyContent: "center" }}>
              <button style={styles.smallBtn} onClick={() => onLoad(d)}>Load</button>
              <button style={{ ...styles.smallBtn, background: "#f97373" }} onClick={() => onDelete(d.id)}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const styles = {
  grid: {
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  card: {
    width: 140,
    textAlign: "center",
  },
  thumb: {
    width: 140,
    height: 90,
    objectFit: "cover",
    borderRadius: 6,
    border: "1px solid #ddd",
    cursor: "pointer",
    boxShadow: "0 4px 8px rgba(0,0,0,0.08)",
  },
  smallBtn: {
    padding: "6px 8px",
    background: "#2575fc",
    color: "white",
    border: "none",
    borderRadius: 6,
    cursor: "pointer",
    fontSize: 12,
  },
};
