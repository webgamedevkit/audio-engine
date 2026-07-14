import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "stores/index": "src/stores/index.ts",
    "react/index": "src/react/index.ts",
    "r3f/index": "src/r3f/index.ts",
  },
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  external: ["react", "react-dom", "zustand", "@react-three/fiber", "three"],
});
