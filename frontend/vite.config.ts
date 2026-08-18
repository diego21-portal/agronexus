import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],

  server: {
    port: 5173,
  },

  build: {
    cssMinify: "esbuild",
  },

  test: {
    environment: "jsdom",

    setupFiles: [
      "./src/test/setup.ts",
    ],

    /*
     * Vitest SOLO puede ejecutar
     * tests ubicados dentro de src/.
     *
     * De esta forma nunca tomará
     * los tests E2E de Playwright.
     */
    include: [
      "src/**/*.{test,spec}.{ts,tsx}",
    ],

    exclude: [
      "e2e/**",
      "node_modules/**",
      "dist/**",
      "coverage/**",
      "playwright-report/**",
      "test-results/**",
    ],

    /*
     * En Windows usamos worker_threads
     * en lugar de child_process/forks.
     */
    pool: "threads",

    /*
     * Nuestra suite todavía es pequeña.
     * Ejecutarla secuencialmente evita
     * workers innecesarios y hace el
     * entorno mucho más estable.
     */
    fileParallelism: false,

    css: true,

    coverage: {
      provider: "v8",

      reporter: [
        "text",
        "html",
        "lcov",
      ],

      reportsDirectory:
        "./coverage",

      include: [
        "src/**/*.{ts,tsx}",
      ],

      exclude: [
        "src/main.tsx",
        "src/vite-env.d.ts",

        "src/test/**",

        "src/**/*.test.{ts,tsx}",
        "src/**/*.spec.{ts,tsx}",
      ],
    },
  },
});