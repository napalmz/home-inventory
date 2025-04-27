import React from 'react'
import ReactDOM from "react-dom/client";
import './index.css'
import App from './App'
import { AuthProvider } from "./auth-context"
import { createApiInstance } from './api';

fetch("/config.json")
  .then((res) => {
    if (!res.ok) throw new Error("Config file not found");
    return res.json();
  })
  .then((config) => {
    window.APP_CONFIG = config;
    createApiInstance(); // 👉 crea l'istanza solo ora!
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
    ReactDOM.createRoot(document.getElementById("root")!).render(
      <div style={{ padding: '20px', textAlign: 'center' }}>
        Errore: impossibile caricare la configurazione. Contattare l'amministratore.
      </div>
    );
  });