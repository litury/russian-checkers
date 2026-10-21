import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = fileURLToPath(new URL('..', import.meta.url));
const failures = [];
let checked = 0;

function verify(file, specifier) {
	let target;
	if (specifier.startsWith('@/')) target = specifier.slice(2);
	else if (specifier.startsWith('.'))
		target = path.relative(
			root,
			path.resolve(root, path.dirname(file), specifier),
		);
	else if (specifier.startsWith('/client/')) target = specifier.slice(1);
	else {
		if (file.startsWith('client/') && specifier.startsWith('node:'))
			failures.push(`${file}: browser imports ${specifier}`);
		return;
	}
	const denied =
		(file.startsWith('shared/') && !target.startsWith('shared/')) ||
		(file.startsWith('client/') && target.startsWith('server/')) ||
		(file.startsWith('server/') && target.startsWith('client/')) ||
		(file.startsWith('client/platform/') &&
			/^(client\/(app|features)|server)\//.test(target)) ||
		(file.startsWith('client/features/') && target.startsWith('client/app/'));
	if (denied) failures.push(`${file}: forbidden dependency ${specifier}`);
}

function visit(directory) {
	for (const entry of readdirSync(path.join(root, directory), {
		withFileTypes: true,
	})) {
		if (entry.name === 'node_modules') continue;
		const file = path.join(directory, entry.name);
		if (entry.isDirectory()) {
			visit(file);
			continue;
		}
		if (!file.endsWith('.ts') || file.endsWith('.d.ts')) continue;
		checked += 1;
		const source = ts.createSourceFile(
			file,
			readFileSync(path.join(root, file), 'utf8'),
			ts.ScriptTarget.Latest,
			true,
		);
		function scan(node) {
			if (
				(ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
				node.moduleSpecifier &&
				ts.isStringLiteral(node.moduleSpecifier)
			)
				verify(file, node.moduleSpecifier.text);
			if (
				ts.isCallExpression(node) &&
				node.expression.kind === ts.SyntaxKind.ImportKeyword &&
				node.arguments[0] &&
				ts.isStringLiteral(node.arguments[0])
			)
				verify(file, node.arguments[0].text);
			ts.forEachChild(node, scan);
		}
		scan(source);
	}
}

for (const directory of ['client', 'server/src', 'shared']) visit(directory);
if (failures.length) {
	process.stderr.write(`${failures.join('\n')}\n`);
	process.exitCode = 1;
} else process.stdout.write(`Module boundaries valid (${checked} modules)\n`);
