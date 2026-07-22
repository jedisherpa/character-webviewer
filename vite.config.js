import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const newsWiz =
    (env.VITE_NEWSWIZ_URL || env.VITE_LIVE_API_BASE || "https://newswiz.5.78.137.112.sslip.io")
      .trim()
      .replace(/\/+$/, "");

  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    server: {
      host: "localhost",
      port: 4400,
      proxy: {
        // Same-origin /api → NewsWiz so session tokens + rant/TTS work in Studio.
        "/api": {
          target: newsWiz,
          changeOrigin: true,
          secure: true,
        },
      },
    },
    preview: {
      host: "localhost",
      port: 4401,
      proxy: {
        "/api": {
          target: newsWiz,
          changeOrigin: true,
          secure: true,
        },
      },
    },
    build: {
      outDir: "dist",
      sourcemap: false,
      assetsInlineLimit: 0,
    },
  };
});
