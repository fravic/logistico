import { defineConfig } from "vite";
import glsl from "vite-plugin-glsl";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [glsl(), react()],
  server: {
    host: true,
  },
  optimizeDeps: {
    exclude: ["*.glsl", "*.vert", "*.frag"],
  },
});