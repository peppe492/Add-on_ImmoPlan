import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Importiamo esplicitamente le librerie principali qui per assicurarci che Vite le veda come dipendenze del bundle
import "@google/genai";
import "recharts";

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);