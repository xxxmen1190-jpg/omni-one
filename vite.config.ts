import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    // Raise warning limit — some vendor chunks are legitimately large
    chunkSizeWarningLimit: 600,
    // Target modern browsers for smaller output
    target: "es2020",
    // Minify with esbuild (faster than terser, good enough for production)
    minify: "esbuild",
    // Hashed filenames for long-term browser caching
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
        // Hashed filenames for long-term caching
        entryFileNames: "assets/[name]-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash].[ext]",
      },
    },
  },
  // Pre-bundle critical dependencies for faster dev startup
  optimizeDeps: {
    include: ["react", "react-dom", "zustand"],
    exclude: ["@monaco-editor/react", "monaco-editor"],
  },
  server: {
    // Warm up frequently used modules on dev server start
    warmup: {
      clientFiles: [
        "./src/app/App.tsx",
        "./src/app/main.tsx",
        "./src/ui/components/Chat.tsx",
        "./src/ui/components/Sidebar.tsx",
        "./src/ui/components/auth/AuthScreen.tsx",
      ],
    },
  },
});
