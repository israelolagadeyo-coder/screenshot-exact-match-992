// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { loadEnv, type Plugin } from "vite";

// Rewrite import.meta.env['VITE_X'] / ["VITE_X"] to dot access so Vite's
// env replacement applies in the browser bundle.
function bracketNotationEnvPlugin(): Plugin {
  return {
    name: "bizintel-bracket-notation-env",
    enforce: "pre",
    transform(code, id) {
      if (id.includes("node_modules")) return null;
      if (!/\.[cm]?[jt]sx?$/.test(id.split("?")[0] ?? "")) return null;
      if (!code.includes("import.meta.env[")) return null;
      const next = code.replace(
        /import\.meta\.env\[\s*['"](VITE_[A-Z0-9_]+)['"]\s*\]/g,
        (_m, key: string) => `import.meta.env.${key}`,
      );
      return next === code ? null : { code: next, map: null };
    },
  };
}

export default defineConfig({
  plugins: [bracketNotationEnvPlugin()],
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
