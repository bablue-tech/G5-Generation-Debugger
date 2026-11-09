/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // The rules and sample data live in ../shared so the Python service can use them too.
    fs: { allow: [".."] },
  },
  test: {
    environment: "node",
  },
});
