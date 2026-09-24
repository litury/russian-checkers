import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';
import { devProxyConfig } from './src/dev/proxyConfig';

export default defineConfig(({ mode }) => ({
	server: { ...devProxyConfig(loadEnv(mode, '.', 'DAMKA_DEV_')), allowedHosts: true },
	base: './',
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
		// Preserve the actual stylesheet for raw-source assertions instead of an empty CSS stub.
		css: { include: [/openingGates\.css/] },
		include: ['src/**/*.spec.ts', 'server/src/**/*.spec.ts'],
	},
}));
