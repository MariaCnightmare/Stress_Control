import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";

console.log("[renderer] boot");
window.addEventListener("error", (event) => {
  console.error("[renderer] window error", event.message, event.filename, event.lineno, event.colno);
});
window.addEventListener("unhandledrejection", (event) => {
  console.error("[renderer] unhandledrejection", event.reason);
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
