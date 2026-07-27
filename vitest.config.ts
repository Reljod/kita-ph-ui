import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
    // No @vitejs/plugin-react: it drags in a @babel/core range that conflicts
    // with the one shadcn pins, and Fast Refresh is irrelevant in a test run.
    // Vite's built-in transformer handles the automatic JSX runtime already.
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    test: {
        environment: 'jsdom',
        globals: true,
        setupFiles: ['./tests/setup.ts'],
        include: ['tests/unit/**/*.test.{ts,tsx}'],
        // Playwright owns tests/e2e; vitest must not try to collect it.
        exclude: ['tests/e2e/**', 'node_modules/**'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'html', 'lcov', 'json-summary'],
            reportsDirectory: './coverage',
            include: ['src/**/*.{ts,tsx}'],
            exclude: [
                // Type-only modules: no statements to execute.
                'src/types/**',
                // Next.js route/layout shells that only re-export or compose;
                // their behaviour is asserted through the E2E suite instead.
                'src/app/**/layout.tsx',
                'src/**/*.d.ts',
            ],
            thresholds: {
                lines: 90,
                functions: 90,
                branches: 90,
                statements: 90,
            },
        },
    },
});
