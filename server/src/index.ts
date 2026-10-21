import { createAuthRoutes } from './auth/routes.ts';
import { createAuthService } from './auth/service.ts';
import { createDatabase } from './database/pool.ts';
import { bindHost, bindMessage } from './dev/bind.ts';
import { createMatchRepository } from './matches/repository.ts';
import { createMatchesRoutes } from './matches/routes.ts';
import { createMatchService } from './matches/service.ts';
import { runMigrations } from './migrate.ts';
import { createPlayersRoutes } from './players/routes.ts';
import { createPresenceRoutes } from './presence/routes.ts';
import { createPresenceService } from './presence/service.ts';
import { createStatsRoutes } from './stats/routes.ts';
import { createRateLimiter } from './transport/rateLimit.ts';
import { createApiServer } from './transport/server.ts';

const pool = createDatabase(
	process.env.DATABASE_URL ??
		'postgres://checkers:checkers@127.0.0.1:5433/checkers',
);
await runMigrations((text, params) => pool.query(text, params));
const auth = createAuthService(pool);
const limited = createRateLimiter();
const presence = createPresenceService();
const matches = createMatchService(createMatchRepository(pool), auth, limited);
const server = createApiServer(pool, matches, [
	createStatsRoutes(pool),
	createPresenceRoutes(presence, auth),
	createPlayersRoutes(pool, limited),
	createAuthRoutes(pool, auth, limited),
	createMatchesRoutes(pool, auth),
]);
let stopping = false;
const shutdown = () => {
	if (stopping) return;
	stopping = true;
	matches.dispose();
	server.close(() => {
		void pool.end();
	});
	server.closeAllConnections();
};
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
server.on('error', (error) => {
	process.stderr.write('checkers-server ' + error + '\n');
	process.exitCode = 1;
	shutdown();
});
process.on('uncaughtException', (error) =>
	process.stderr.write('uncaught ' + error + '\n'),
);
process.on('unhandledRejection', (error) =>
	process.stderr.write('unhandled ' + error + '\n'),
);
server.listen(
	Number(process.env.PORT ?? 8787),
	bindHost(process.env.HOST),
	() => process.stdout.write(bindMessage(server.address()) + '\n'),
);
