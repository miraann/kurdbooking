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
    // Native wrappers have their own packages and build tools.
    "native/**",
    // Third-party files we host ourselves (the map's right-to-left text plugin), not our code.
    "public/vendor/**",
  ]),
]);

export default eslintConfig;
