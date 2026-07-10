import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    // Raise warning limit — some vendor chunks are legitimately large
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          // React core — always needed
          "vendor-react": ["react", "react-dom", "react-is"],
          // State management
          "vendor-state": ["zustand"],
          // Markdown rendering
          "vendor-markdown": ["react-markdown", "remark-gfm", "marked"],
          // PDF / export heavy libs — only loaded on export
          "vendor-pdf": ["jspdf", "html2canvas", "pdfmake"],
          // Office / spreadsheet libs — only loaded on export
          "vendor-office": ["docx", "xlsx", "jszip", "file-saver"],
          // CSV
          "vendor-csv": ["csv-parse", "csv-stringify"],
          // Document parsing
          "vendor-parse": ["mammoth", "pdf-parse"],
          // Charts
          "vendor-charts": ["recharts"],
          // Code editor
          "vendor-editor": ["@monaco-editor/react", "monaco-editor"],
          // Syntax highlighting
          "vendor-highlight": ["react-syntax-highlighter"],
          // Drag and drop
          "vendor-dnd": ["react-dropzone"],
        },
      },
    },
  },
});
