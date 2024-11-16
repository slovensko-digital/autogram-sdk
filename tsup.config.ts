import { defineConfig } from "tsup";

export default defineConfig({
  platform: "browser",
  minify: true,
  dts: true,
  sourcemap: true,
  format: ["cjs", "esm", "iife"],
  outDir: "dist",
  esbuildOptions(options, context) {
    options.loader = {
      ...options.loader,
      ".css": "text",
    };
    options.globalName = "AutogramSDK";
    return options;
  },
});
