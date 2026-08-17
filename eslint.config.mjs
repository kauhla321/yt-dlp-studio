// ESLint v9 flat config (neostandard baseline).
//
// The project has its own consistent style (semicolons, double quotes), so
// stylistic rules are disabled (noStyle) — only logic/quality rules run.
import neostandard from "neostandard";

export default [
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "release/**",
      "data/**",
      "next-env.d.ts",
      "tsconfig.tsbuildinfo",
      "UI REQUIRMENT/**",
    ],
  },
  ...neostandard({ ts: true, noStyle: true }),
  {
    rules: {
      // `void` is used deliberately for fire-and-forget async calls.
      "no-void": "off",
      // The filename sanitizer intentionally strips ASCII control characters
      // (\x00-\x1f) from folder names — that regex is the point of the rule.
      "no-control-regex": "off",
    },
  },
];
