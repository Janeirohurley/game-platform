import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Vendored decoders/engine (Basis, Draco, Stockfish) served as static
    // assets. They are not authored by us and must not be linted.
    "public/chess/basis/**",
    "public/chess/draco/**",
    "public/chess/stockfish/**",
  ]),
]);

export default eslintConfig;
