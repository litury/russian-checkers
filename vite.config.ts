import { defineConfig, loadEnv } from 'vite';
import { devProxyConfig } from './tools/devProxyConfig.ts';

export default defineConfig(({ mode }) => ({
	define: {
		__DAMKA_BUILD__: JSON.stringify(
			`${mode === 'development' ? 'dev' : 'build'}-${new Date().toISOString().replace(/[-:.TZ]/g, '')}-${crypto.randomUUID().slice(0, 6)}`,
		),
	},
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
