import React from 'react'
import ReactDOM from "react-dom/client";
import './index.css'
import App from './App'
import { AuthProvider } from "./auth-context"

fetch("/config.json")
  .then((res) => {
    if (!res.ok) throw new Error("Config file not found");
    return res.json();
  })
  .then((config) => {
    window.APP_CONFIG = config;
    ReactDOM.createRoot(document.getElementById("root")!).render(
      <React.StrictMode>
        <AuthProvider>
          <App />
        </AuthProvider>
      </React.StrictMode>
    );
  })
  .catch((err) => {
    console.error("Errore caricamento config.json:", err);
    // eventualmente mostra un fallback UI o errore
  });