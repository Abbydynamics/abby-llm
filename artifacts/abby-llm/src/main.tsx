import { createRoot } from "react-dom/client";
import App from "./App";
import { AbbyProvider } from "@/hooks/useAbby";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <AbbyProvider>
    <App />
  </AbbyProvider>,
);
