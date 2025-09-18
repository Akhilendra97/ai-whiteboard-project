// Leave as "" for same-origin (backend serves dist).
// If you test frontend separately and want to call a backend on another origin,
// set VITE_API_URL in an .env file or replace the string below.
const API_URL = import.meta.env.VITE_API_URL || "";
export default API_URL;
