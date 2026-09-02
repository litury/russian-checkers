import { defineConfig } from 'vitest/config';

export default defineConfig({
	resolve: {
		alias: {
			'@': new URL('./src', import.meta.url).pathname,
		},
	},
	build: {
		outDir: 'dist',
		emptyOutDir: true,
		target: 'es2022',
		chunkSizeWarningLimit: 2000,
	},
	test: {
		environment: 'node',
		include: ['src/**/*.spec.ts'],
	},
});
