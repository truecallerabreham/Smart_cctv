import react from "@vitejs/plugin-react-swc";
import path from "path";
import { defineConfig } from "vite";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "0.0.0.0",
    port: 3000,
    strictPort: true,
    // The UI appends ?XTransformPort=8080 to its fetch() calls — a sandbox
    // routing convention. When running locally (no sandbox edge layer),
    // proxy those paths to the API on port 8080 so the UI works unchanged.
    proxy: {
      "/chat": { target: "http://localhost:8080", changeOrigin: true },
      "/upload-video": { target: "http://localhost:8080", changeOrigin: true },
      "/process-video": { target: "http://localhost:8080", changeOrigin: true },
      "/task-status": { target: "http://localhost:8080", changeOrigin: true },
      "/reset-memory": { target: "http://localhost:8080", changeOrigin: true },
      "/media": { target: "http://localhost:8080", changeOrigin: true },
    },
  },
  plugins: [
    react(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
