import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base "./" lets the same build work on Vercel, Netlify or a GitHub Pages sub-path.
export default defineConfig({
  plugins: [react()],
  base: "./",
});
