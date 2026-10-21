import { defineConfig, loadEnv } from 'vite';
import { devProxyConfig } from './tools/devProxyConfig.ts';

export default defineConfig(({ mode }) => ({
	server: {
		...devProxyConfig(loadEnv(mode, '.', 'DAMKA_DEV_')),
	},
	base: './',
	resolve: {
		alias: {
			'@': new URL('.', import.meta.url).pathname,
		},
	},
	build: {
		outDir: 'dist',
		emptyOutDir: true,
		target: 'es2022',
		chunkSizeWarningLimit: 2000,
	},
}));
