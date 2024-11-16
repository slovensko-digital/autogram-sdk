import { defineConfig } from "tsup";

export default defineConfig({
  platform: "browser",
  esbuildOptions(options, context) {
    options.loader = {
      ...options.loader,
      ".css": "text",
    };
    return options;
  },
});
