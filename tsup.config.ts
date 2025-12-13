import { defineConfig } from 'tsup';

export default defineConfig({
    entry: ['src/cli.tsx'],
    format: ['esm'],
    outDir: 'dist',
    clean: true,
    noExternal: [/(.*)/],
    shims: true,
    splitting: false,
    sourcemap: false,
    target: 'node20',
    outExtension() {
        return {
            js: '.mjs'
        }
    },
    banner: {
        js: `import { createRequire } from 'module';const require = createRequire(import.meta.url);`,
    },
    define: {
        'process.env.DEV': '"false"'
    }
});
