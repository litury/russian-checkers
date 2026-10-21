import {
	createInitialPosition,
	type IPosition,
	type Side,
} from '@/shared/rules';
import { emptyBoard } from '@/shared/rules/parts/board';

interface ScenarioHooks {
	ready(): Promise<void>;
	start(): Promise<void>;
	configure(position: IPosition, bankMs: number): void;
	result(winner: Side | 'draw'): void;
}

const scenarios = [
	'match',
	'king',
	'capture',
	'promotion',
	'result',
	'clock',
] as const;
type Scenario = (typeof scenarios)[number];

function positionFor(scenario: Scenario): IPosition {
	if (scenario === 'match' || scenario === 'result' || scenario === 'clock')
		return createInitialPosition();
	const position: IPosition = { squares: emptyBoard(), turn: 'white' };
	if (scenario === 'king') {
		position.squares[2][1] = { side: 'white', kind: 'king' };
		position.squares[5][6] = { side: 'black', kind: 'king' };
	} else if (scenario === 'capture') {
		position.squares[2][1] = { side: 'white', kind: 'man' };
		position.squares[3][2] = { side: 'black', kind: 'man' };
		position.squares[5][4] = { side: 'black', kind: 'man' };
		position.squares[7][6] = { side: 'black', kind: 'king' };
	} else {
		position.squares[6][1] = { side: 'white', kind: 'man' };
		position.squares[5][6] = { side: 'black', kind: 'man' };
	}
	return position;
}

export async function runDevScenario(hooks: ScenarioHooks): Promise<void> {
	if (!import.meta.env.DEV) return;
	const parameters = new URLSearchParams(location.search);
	const scenario = parameters.get('dev');
	if (!scenarios.some((value) => value === scenario)) return;
	await hooks.ready();
	await hooks.start();
	hooks.configure(
		positionFor(scenario as Scenario),
		scenario === 'clock' ? 3000 : 60_000,
	);
	if (scenario === 'result') {
		const outcome = parameters.get('outcome');
		hooks.result(
			outcome === 'draw' ? 'draw' : outcome === 'loss' ? 'black' : 'white',
		);
	}
}
