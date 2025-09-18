// src/config.js
const API_URL =
  import.meta.env.VITE_API_URL || ""; // Use "" for same origin (Railway serves frontend + backend)

export default API_URL;
