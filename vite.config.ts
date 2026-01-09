import { defineConfig } from "vite";
import reactRefresh from "@vitejs/plugin-react-refresh";
import { viteSingleFile } from "vite-plugin-singlefile";

// https://vitejs.dev/config/
export default defineConfig({
  root: "./ui-src",
  plugins: [reactRefresh(), viteSingleFile()],
  build: {
    target: "es2017",
    assetsInlineLimit: 100000000,
    chunkSizeWarningLimit: 100000000,
    cssCodeSplit: false,
    outDir: "../dist",
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
        // Use IIFE format instead of ES modules for Figma compatibility
        format: "iife",
        entryFileNames: "[name].js",
      },
    },
  },
});
