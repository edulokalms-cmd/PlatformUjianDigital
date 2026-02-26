import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Disable the Replit dev banner
if (typeof window !== 'undefined') {
  (window as any).__REPLIT_DEV_BANNER_DISABLED = true;
}

createRoot(document.getElementById("root")!).render(<App />);
