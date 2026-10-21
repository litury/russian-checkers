import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { loadEnv } from 'vite';

const root = fileURLToPath(new URL('..', import.meta.url));
const environment = { ...loadEnv('development', root, ''), ...process.env };
const mode = process.argv[2];
const children = new Set();
let stopping = false;
let killTimer;

function stop(code) {
	if (stopping) return;
	stopping = true;
	process.exitCode = code;
	for (const child of children) child.kill('SIGTERM');
	killTimer = setTimeout(() => {
		for (const child of children) child.kill('SIGKILL');
	}, 4000);
	killTimer.unref();
}

function start(name, modulePath, argumentsList) {
	const child = spawn(process.execPath, [modulePath, ...argumentsList], {
		cwd: root,
		env: environment,
		stdio: ['inherit', 'pipe', 'pipe'],
	});
	children.add(child);
	for (const stream of [child.stdout, child.stderr]) {
		const lines = createInterface({ input: stream });
		lines.on('line', (line) => process.stdout.write(`[${name}] ${line}\n`));
	}
	child.on('error', (error) => {
		process.stderr.write(`[${name}] ${error.message}\n`);
		stop(1);
	});
	child.on('exit', (code) => {
		children.delete(child);
		if (!stopping) stop(code || 1);
		if (!children.size) clearTimeout(killTimer);
	});
}

process.once('SIGINT', () => stop(0));
process.once('SIGTERM', () => stop(0));

if (mode === 'api' || mode === 'all') {
	start('api', 'node_modules/tsx/dist/cli.mjs', [
		'watch',
		'--tsconfig',
		'server/tsconfig.json',
		'server/src/index.ts',
	]);
}
if (mode === 'all') {
	start('client', 'node_modules/vite/bin/vite.js', process.argv.slice(3));
}
if (mode === 'types') {
	start('client-types', 'node_modules/typescript/bin/tsc', [
		'--noEmit',
		'--watch',
	]);
	start('api-types', 'node_modules/typescript/bin/tsc', [
		'-p',
		'server/tsconfig.json',
		'--watch',
	]);
}
if (!['api', 'all', 'types'].includes(mode)) {
	process.stderr.write('Expected api, all or types\n');
	process.exitCode = 1;
}
