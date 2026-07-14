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
  minify: "terser",
  sourcemap: false,
  clean: true,
  treeshake: true,
  terserOptions: {
    compress: {
      passes: 2,
      drop_debugger: true,
    },
    mangle: {
      toplevel: true,
    },
    format: {
      comments: false,
    },
  },
  external: ["react", "react-dom", "zustand", "@react-three/fiber", "three"],
});
