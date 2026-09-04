import Phaser from 'phaser';
import {
	captureSprites,
	debrisSprites,
	fireSprites,
	pathSprites,
	pieceSprites,
	pitSprites,
	tableLayers,
	wreathSprites,
} from '@/client/config/layout';
import { palette } from '@/client/config/palette';
import type { IBoardView } from '@/client/modules/board';
import { createBoardView } from '@/client/modules/board';
import tongue0IdleUrl from '@/client/modules/board/fire_rocket/tongue_0_idle.png';
import tongue0LandUrl from '@/client/modules/board/fire_rocket/tongue_0_land.png';
import tongue0UpUrl from '@/client/modules/board/fire_rocket/tongue_0_up.png';
import tongue1IdleUrl from '@/client/modules/board/fire_rocket/tongue_1_idle.png';
import tongue1LandUrl from '@/client/modules/board/fire_rocket/tongue_1_land.png';
import tongue1UpUrl from '@/client/modules/board/fire_rocket/tongue_1_up.png';
import tongue2IdleUrl from '@/client/modules/board/fire_rocket/tongue_2_idle.png';
import tongue2LandUrl from '@/client/modules/board/fire_rocket/tongue_2_land.png';
import tongue2UpUrl from '@/client/modules/board/fire_rocket/tongue_2_up.png';
import emberUrl from '@/client/modules/board/kit_v2/fx/ember.png';
import puff0Url from '@/client/modules/board/kit_v2/fx/puff_0.png';
import puff1Url from '@/client/modules/board/kit_v2/fx/puff_1.png';
import puff2Url from '@/client/modules/board/kit_v2/fx/puff_2.png';
import { hopMovesForSelection } from '@/client/modules/board/parts/hopRays';
import pathCrossUrl from '@/client/modules/board/path_cross.png';
import pathDashUrl from '@/client/modules/board/path_dash.png';
import kingDarkUrl from '@/client/modules/board/pieces/king_dark.png';
import kingLightUrl from '@/client/modules/board/pieces/king_light.png';
import manDarkUrl from '@/client/modules/board/pieces/man_dark.png';
import manLightUrl from '@/client/modules/board/pieces/man_light.png';
import debrisStoneGmUrl from '@/client/modules/board/table_layers/debris_grass_stone_gm.png';
import debrisStonePlUrl from '@/client/modules/board/table_layers/debris_grass_stone_pl.png';
import earthGrassUrl from '@/client/modules/board/table_layers/earth_grass.png';
import pitGrass00Url from '@/client/modules/board/table_layers/pit_grass_00.png';
import pitGrass01Url from '@/client/modules/board/table_layers/pit_grass_01.png';
import pitGrass02Url from '@/client/modules/board/table_layers/pit_grass_02.png';
import pitGrass03Url from '@/client/modules/board/table_layers/pit_grass_03.png';
import pitGrass04Url from '@/client/modules/board/table_layers/pit_grass_04.png';
import pitGrass05Url from '@/client/modules/board/table_layers/pit_grass_05.png';
import pitGrass06Url from '@/client/modules/board/table_layers/pit_grass_06.png';
import pitGrass07Url from '@/client/modules/board/table_layers/pit_grass_07.png';
import selectMaskUrl from '@/client/modules/board/table_layers/select_mask.png';
import captureBurstDark00Url from '@/client/modules/board/vfx_capture/capture_burst_dark_00.png';
import captureBurstDark01Url from '@/client/modules/board/vfx_capture/capture_burst_dark_01.png';
import captureBurstKingDark00Url from '@/client/modules/board/vfx_capture/capture_burst_king_dark_00.png';
import captureBurstKingDark01Url from '@/client/modules/board/vfx_capture/capture_burst_king_dark_01.png';
import captureBurstKingLight00Url from '@/client/modules/board/vfx_capture/capture_burst_king_light_00.png';
import captureBurstKingLight01Url from '@/client/modules/board/vfx_capture/capture_burst_king_light_01.png';
import captureBurstLight00Url from '@/client/modules/board/vfx_capture/capture_burst_light_00.png';
import captureBurstLight01Url from '@/client/modules/board/vfx_capture/capture_burst_light_01.png';
import captureFlash00Url from '@/client/modules/board/vfx_capture/capture_flash_00.png';
import captureFlash01Url from '@/client/modules/board/vfx_capture/capture_flash_01.png';
import captureFlash02Url from '@/client/modules/board/vfx_capture/capture_flash_02.png';
import captureFlash03Url from '@/client/modules/board/vfx_capture/capture_flash_03.png';
import captureIgniteDarkUrl from '@/client/modules/board/vfx_capture/capture_ignite_dark.png';
import captureIgniteKingDarkUrl from '@/client/modules/board/vfx_capture/capture_ignite_king_dark.png';
import captureIgniteKingLightUrl from '@/client/modules/board/vfx_capture/capture_ignite_king_light.png';
import captureIgniteLightUrl from '@/client/modules/board/vfx_capture/capture_ignite_light.png';
import captureScorchUrl from '@/client/modules/board/vfx_capture/capture_scorch_96.png';
import captureSmolderDark00Url from '@/client/modules/board/vfx_capture/capture_smolder_dark_00.png';
import captureSmolderDark01Url from '@/client/modules/board/vfx_capture/capture_smolder_dark_01.png';
import captureSmolderKingDark00Url from '@/client/modules/board/vfx_capture/capture_smolder_king_dark_00.png';
import captureSmolderKingDark01Url from '@/client/modules/board/vfx_capture/capture_smolder_king_dark_01.png';
import captureSmolderKingLight00Url from '@/client/modules/board/vfx_capture/capture_smolder_king_light_00.png';
import captureSmolderKingLight01Url from '@/client/modules/board/vfx_capture/capture_smolder_king_light_01.png';
import captureSmolderLight00Url from '@/client/modules/board/vfx_capture/capture_smolder_light_00.png';
import captureSmolderLight01Url from '@/client/modules/board/vfx_capture/capture_smolder_light_01.png';
import captureSwellDark00Url from '@/client/modules/board/vfx_capture/capture_swell_dark_00.png';
import captureSwellDark01Url from '@/client/modules/board/vfx_capture/capture_swell_dark_01.png';
import captureSwellDark02Url from '@/client/modules/board/vfx_capture/capture_swell_dark_02.png';
import captureSwellKingDark00Url from '@/client/modules/board/vfx_capture/capture_swell_king_dark_00.png';
import captureSwellKingDark01Url from '@/client/modules/board/vfx_capture/capture_swell_king_dark_01.png';
import captureSwellKingDark02Url from '@/client/modules/board/vfx_capture/capture_swell_king_dark_02.png';
import captureSwellKingLight00Url from '@/client/modules/board/vfx_capture/capture_swell_king_light_00.png';
import captureSwellKingLight01Url from '@/client/modules/board/vfx_capture/capture_swell_king_light_01.png';
import captureSwellKingLight02Url from '@/client/modules/board/vfx_capture/capture_swell_king_light_02.png';
import captureSwellLight00Url from '@/client/modules/board/vfx_capture/capture_swell_light_00.png';
import captureSwellLight01Url from '@/client/modules/board/vfx_capture/capture_swell_light_01.png';
import captureSwellLight02Url from '@/client/modules/board/vfx_capture/capture_swell_light_02.png';
import { pickBotMove } from '@/client/modules/bot';
import captureUrl from '@/client/modules/sfx/capture.ogg';
import {
	createTableSfx,
	preloadTableSfx,
} from '@/client/modules/sfx/createTableSfx';
import flightUrl from '@/client/modules/sfx/hop/flight.ogg';
import hoverUrl from '@/client/modules/sfx/hop/hover.ogg';
import igniteUrl from '@/client/modules/sfx/hop/ignite.ogg';
import landUrl from '@/client/modules/sfx/hop/land.ogg';
import meadowUrl from '@/client/modules/sfx/meadow_loop.ogg';
import firstCaptureUrl from '@/client/modules/sfx/pervyy_vzryv.ogg';
import selectUrl from '@/client/modules/sfx/select.ogg';
import { sameSquare } from '@/client/shared/sameSquare';
import type { IMove, IPosition, ISquare, Side } from '@/rules';
import {
	afterFlagBank,
	afterMoveBank,
	apply,
	blitzStartMs,
	countdownBeatMs,
	countdownBeats,
	createInitialPosition,
	explodeFlag,
	legalMoves,
	remainingMs,
	winner,
} from '@/rules';
import { hudFont } from '@/client/fonts/fonts';
import { createHud } from './createHud';
import { createTitleOverlay } from './titleOverlay';
import type { IYandexSdk } from './IYandexSdk';
import { getAutoMove } from './parts/createSfxPanel';
import { createResultOverlay } from './resultOverlay';
import titleBg169Url from './ui/title/title_bg_169.png';
import titleBg916Url from './ui/title/title_bg_916.png';
import hudActionMoatUrl from './ui/hud_action_moat.png';
import hudAiUrl from './ui/hud_ai.png';
import hudAiOffUrl from './ui/hud_ai_off.png';
import hudGlassMeadowUrl from './ui/hud_glass_meadow.png';
import hudMenuUrl from './ui/hud_menu.png';
import hudMenuFoldUrl from './ui/hud_menu_fold.png';
import hudMenuOpenUrl from './ui/hud_menu_open.png';
import hudMenuPressUrl from './ui/hud_menu_press.png';
import hudMenuF0Url from './ui/hud_menu_f0.png';
import hudMenuF1Url from './ui/hud_menu_f1.png';
import hudMenuF2Url from './ui/hud_menu_f2.png';
import hudNoteUrl from './ui/hud_note.png';
import hudNoteOffUrl from './ui/hud_note_off.png';
import hudPlateUrl from './ui/hud_plate.png';
import hudPlateVolUrl from './ui/hud_plate_vol.png';
import hudResignUrl from './ui/hud_resign.png';
import hudResignWaveUrl from './ui/hud_resign_wave.png';
import hudSliderKnobUrl from './ui/hud_slider_knob.png';
import mascotIdleUrl from './ui/result/mascot_idle.png';
import mascotIdle0Url from './ui/result/mascot_idle_00.png';
import mascotIdle1Url from './ui/result/mascot_idle_01.png';
import mascotIdle2Url from './ui/result/mascot_idle_02.png';
import mascotIdle3Url from './ui/result/mascot_idle_03.png';
import mascotLose0Url from './ui/result/mascot_lose_00.png';
import mascotLose1Url from './ui/result/mascot_lose_01.png';
import mascotLose2Url from './ui/result/mascot_lose_02.png';
import mascotLose3Url from './ui/result/mascot_lose_03.png';
import mascotLose4Url from './ui/result/mascot_lose_04.png';
import mascotLose5Url from './ui/result/mascot_lose_05.png';
import mascotWin0Url from './ui/result/mascot_win_00.png';
import mascotWin1Url from './ui/result/mascot_win_01.png';
import mascotWin2Url from './ui/result/mascot_win_02.png';
import mascotWin3Url from './ui/result/mascot_win_03.png';
import mascotWin4Url from './ui/result/mascot_win_04.png';
import resultBtnUrl from './ui/result/result_btn.png';
import resultGlassMeadowUrl from './ui/result/result_glass_meadow.png';
import resultGlassLoseUrl from './ui/result/result_glass_lose.png';
import resultGlassWinUrl from './ui/result/result_glass_win.png';
import resultMonitorUrl from './ui/result/result_monitor.png';

export class GameScene extends Phaser.Scene {
	private board!: IBoardView;
	private hud!: ReturnType<typeof createHud>;
	private overlay!: ReturnType<typeof createResultOverlay>;
	private title!: ReturnType<typeof createTitleOverlay>;
	private sdk!: IYandexSdk;
	private sfx!: ReturnType<typeof createTableSfx>;
	private position: IPosition = createInitialPosition();
	private selected: ISquare | null = null;
	private phase: 'title' | 'human' | 'bot' | 'over' = 'title';
	private paused = false;
	private pendingBot = false;
	private moving = false;
	private elapsedMs = 0;
	private runningSince = 0;
	private clocks = { white: blitzStartMs, black: blitzStartMs };
	private clockStartedAt = 0;
	private flagLock = false;
	private countingIn = false;
	private countText?: Phaser.GameObjects.Text;
	private countEvent?: Phaser.Time.TimerEvent;
	private botTimer?: Phaser.Time.TimerEvent;

	constructor() {
		super({ key: 'GameScene' });
	}

	preload(): void {
		this.load.image(tableLayers.earth, earthGrassUrl);
		this.load.image(pitSprites.keys[0], pitGrass00Url);
		this.load.image(pitSprites.keys[1], pitGrass01Url);
		this.load.image(pitSprites.keys[2], pitGrass02Url);
		this.load.image(pitSprites.keys[3], pitGrass03Url);
		this.load.image(pitSprites.keys[4], pitGrass04Url);
		this.load.image(pitSprites.keys[5], pitGrass05Url);
		this.load.image(pitSprites.keys[6], pitGrass06Url);
		this.load.image(pitSprites.keys[7], pitGrass07Url);
		this.load.image(debrisSprites.stonePl, debrisStonePlUrl);
		this.load.image(debrisSprites.stoneGm, debrisStoneGmUrl);
		this.load.image(pieceSprites.manLight, manLightUrl);
		this.load.image(pieceSprites.manDark, manDarkUrl);
		this.load.image(pieceSprites.kingLight, kingLightUrl);
		this.load.image(pieceSprites.kingDark, kingDarkUrl);
		this.load.image(wreathSprites.mask, selectMaskUrl);
		this.load.image(pathSprites.dash, pathDashUrl);
		this.load.image(pathSprites.cross, pathCrossUrl);
		this.load.image(fireSprites.ember, emberUrl);
		this.load.image(fireSprites.idle[0], tongue0IdleUrl);
		this.load.image(fireSprites.idle[1], tongue1IdleUrl);
		this.load.image(fireSprites.idle[2], tongue2IdleUrl);
		this.load.image(fireSprites.up[0], tongue0UpUrl);
		this.load.image(fireSprites.up[1], tongue1UpUrl);
		this.load.image(fireSprites.up[2], tongue2UpUrl);
		this.load.image(fireSprites.land[0], tongue0LandUrl);
		this.load.image(fireSprites.land[1], tongue1LandUrl);
		this.load.image(fireSprites.land[2], tongue2LandUrl);
		this.load.image(fireSprites.puffs[0], puff0Url);
		this.load.image(fireSprites.puffs[1], puff1Url);
		this.load.image(fireSprites.puffs[2], puff2Url);
		this.load.image('hudMenu', hudMenuUrl);
		this.load.image('hudMenuFold', hudMenuFoldUrl);
		this.load.image('hudMenuOpen', hudMenuOpenUrl);
		this.load.image('hudMenuPress', hudMenuPressUrl);
		this.load.image('hudMenuF0', hudMenuF0Url);
		this.load.image('hudMenuF1', hudMenuF1Url);
		this.load.image('hudMenuF2', hudMenuF2Url);
		this.load.image('hudGlassMeadow', hudGlassMeadowUrl);
		this.load.image('hudPlateVol', hudPlateVolUrl);
		this.load.image('hudPlate', hudPlateUrl);
		this.load.image('hudNote', hudNoteUrl);
		this.load.image('hudNoteOff', hudNoteOffUrl);
		this.load.image('hudSliderKnob', hudSliderKnobUrl);
		this.load.image('hudActionMoat', hudActionMoatUrl);
		this.load.image('hudResign', hudResignUrl);
		this.load.image('hudResignWave', hudResignWaveUrl);
		this.load.image('hudAi', hudAiUrl);
		this.load.image('hudAiOff', hudAiOffUrl);
		this.load.image(captureSprites.igniteLight, captureIgniteLightUrl);
		this.load.image(captureSprites.igniteDark, captureIgniteDarkUrl);
		this.load.image(captureSprites.igniteKingLight, captureIgniteKingLightUrl);
		this.load.image(captureSprites.igniteKingDark, captureIgniteKingDarkUrl);
		this.load.image(captureSprites.swellLight[0], captureSwellLight00Url);
		this.load.image(captureSprites.swellLight[1], captureSwellLight01Url);
		this.load.image(captureSprites.swellLight[2], captureSwellLight02Url);
		this.load.image(captureSprites.swellDark[0], captureSwellDark00Url);
		this.load.image(captureSprites.swellDark[1], captureSwellDark01Url);
		this.load.image(captureSprites.swellDark[2], captureSwellDark02Url);
		this.load.image(
			captureSprites.swellKingLight[0],
			captureSwellKingLight00Url,
		);
		this.load.image(
			captureSprites.swellKingLight[1],
			captureSwellKingLight01Url,
		);
		this.load.image(
			captureSprites.swellKingLight[2],
			captureSwellKingLight02Url,
		);
		this.load.image(captureSprites.swellKingDark[0], captureSwellKingDark00Url);
		this.load.image(captureSprites.swellKingDark[1], captureSwellKingDark01Url);
		this.load.image(captureSprites.swellKingDark[2], captureSwellKingDark02Url);
		this.load.image(captureSprites.burstLight[0], captureBurstLight00Url);
		this.load.image(captureSprites.burstLight[1], captureBurstLight01Url);
		this.load.image(captureSprites.burstDark[0], captureBurstDark00Url);
		this.load.image(captureSprites.burstDark[1], captureBurstDark01Url);
		this.load.image(
			captureSprites.burstKingLight[0],
			captureBurstKingLight00Url,
		);
		this.load.image(
			captureSprites.burstKingLight[1],
			captureBurstKingLight01Url,
		);
		this.load.image(captureSprites.burstKingDark[0], captureBurstKingDark00Url);
		this.load.image(captureSprites.burstKingDark[1], captureBurstKingDark01Url);
		this.load.image(captureSprites.smolderLight[0], captureSmolderLight00Url);
		this.load.image(captureSprites.smolderLight[1], captureSmolderLight01Url);
		this.load.image(captureSprites.smolderDark[0], captureSmolderDark00Url);
		this.load.image(captureSprites.smolderDark[1], captureSmolderDark01Url);
		this.load.image(
			captureSprites.smolderKingLight[0],
			captureSmolderKingLight00Url,
		);
		this.load.image(
			captureSprites.smolderKingLight[1],
			captureSmolderKingLight01Url,
		);
		this.load.image(
			captureSprites.smolderKingDark[0],
			captureSmolderKingDark00Url,
		);
		this.load.image(
			captureSprites.smolderKingDark[1],
			captureSmolderKingDark01Url,
		);
		this.load.image(captureSprites.flash[0], captureFlash00Url);
		this.load.image(captureSprites.flash[1], captureFlash01Url);
		this.load.image(captureSprites.flash[2], captureFlash02Url);
		this.load.image(captureSprites.flash[3], captureFlash03Url);
		this.load.image(captureSprites.scorch, captureScorchUrl);
		this.load.image('resultMonitor', resultMonitorUrl);
		this.load.image('resultGlassMeadow', resultGlassMeadowUrl);
		this.load.image('mascotIdle', mascotIdleUrl);
		this.load.image('mascotIdle0', mascotIdle0Url);
		this.load.image('mascotIdle1', mascotIdle1Url);
		this.load.image('mascotIdle2', mascotIdle2Url);
		this.load.image('mascotIdle3', mascotIdle3Url);
		this.load.image('resultGlassWin', resultGlassWinUrl);
		this.load.image('resultGlassLose', resultGlassLoseUrl);
		this.load.image('resultBtn', resultBtnUrl);
		this.load.image('titleBg916', titleBg916Url);
		this.load.image('titleBg169', titleBg169Url);
		this.load.image('mascotLose0', mascotLose0Url);
		this.load.image('mascotLose1', mascotLose1Url);
		this.load.image('mascotLose2', mascotLose2Url);
		this.load.image('mascotLose3', mascotLose3Url);
		this.load.image('mascotLose4', mascotLose4Url);
		this.load.image('mascotLose5', mascotLose5Url);
		this.load.image('mascotWin0', mascotWin0Url);
		this.load.image('mascotWin1', mascotWin1Url);
		this.load.image('mascotWin2', mascotWin2Url);
		this.load.image('mascotWin3', mascotWin3Url);
		this.load.image('mascotWin4', mascotWin4Url);
		preloadTableSfx(this, {
			select: selectUrl,
			hover: hoverUrl,
			ignite: igniteUrl,
			flight: flightUrl,
			land: landUrl,
			capture: captureUrl,
		});
	}

	create(): void {
		this.sdk = this.registry.get('sdk') as IYandexSdk;
		this.cameras.main.setBackgroundColor(palette.background);
		for (const key of [
			'hudMenu',
			'hudMenuOpen',
			'hudMenuFold',
			'hudMenuPress',
			'hudMenuF0',
			'hudMenuF1',
			'hudMenuF2',
			'hudGlassMeadow',
			'hudPlateVol',
			'hudPlate',
			'hudNote',
			'hudNoteOff',
			'hudSliderKnob',
			'hudActionMoat',
			'hudResign',
			'hudResignWave',
			'hudAi',
			'hudAiOff',
			'resultMonitor',
			'resultGlassMeadow',
			'titleBg916',
			'titleBg169',
			'mascotIdle',
			'mascotIdle0',
			'mascotIdle1',
			'mascotIdle2',
			'mascotIdle3',
		]) {
			if (!this.textures.exists(key)) {
				continue;
			}
			this.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
		}
		this.sfx = createTableSfx(this, {
			meadow: meadowUrl,
			firstCapture: firstCaptureUrl,
		});
		this.hud = createHud(this, {
			onResign: () => {
				this.resignMatch();
			},
			onAutoChange: () => {
				this.refresh();
			},
		});
		this.hud.setVisible(false);
		this.countText = this.add
			.text(0, 0, '', {
				fontFamily: hudFont,
				fontSize: '96px',
				color: palette.text,
			})
			.setOrigin(0.5)
			.setStroke('#1a1410', 8)
			.setDepth(40)
			.setVisible(false);
		this.board = createBoardView(this, (square) => {
			this.onSquare(square);
		});
		this.board.setPlayfieldVisible(false);
		this.title = createTitleOverlay(this, {
			onPlayBot: () => {
				this.startMatch();
			},
		});
		this.overlay = createResultOverlay(this, {
			onPlayAgain: () => {
				this.startMatch();
			},
			onMenu: () => {
				this.showTitle();
			},
		});
		this.sdk.onPause(() => {
			this.setPaused(true);
		});
		this.sdk.onResume(() => {
			this.setPaused(false);
		});
		this.scale.on('resize', (gameSize: { width: number; height: number }) => {
			this.layout(gameSize.width, gameSize.height);
		});
		this.time.addEvent({
			delay: 100,
			loop: true,
			callback: () => {
				this.tickClock();
			},
		});
		this.board.layout(this.scale.width, this.scale.height);
		this.hud.layout(this.scale.width, this.scale.height);
		this.overlay.layout(this.scale.width, this.scale.height);
		this.title.layout(this.scale.width, this.scale.height);
		this.showTitle();
		this.sdk.ready();
	}

	private showTitle(): void {
		this.botTimer?.remove(false);
		this.tweens.killAll();
		this.board.reset();
		this.moving = false;
		this.position = createInitialPosition();
		this.selected = null;
		this.phase = 'title';
		this.pendingBot = false;
		this.overlay.hide();
		this.hud.setVisible(false);
		this.stopCountdown();
		this.board.setPlayfieldVisible(false);
		this.sfx.stopHover();
		this.sfx.stopMeadow();
		this.title.show();
		this.sfx.startMeadow();
		this.refresh();
	}

	private startMatch(): void {
		this.botTimer?.remove(false);
		this.tweens.killAll();
		this.board.reset();
		this.moving = false;
		this.position = createInitialPosition();
		this.selected = null;
		this.phase = 'human';
		this.pendingBot = false;
		this.elapsedMs = 0;
		this.runningSince = this.time.now;
		this.clocks = { white: blitzStartMs, black: blitzStartMs };
		this.clockStartedAt = this.time.now;
		this.flagLock = false;
		this.hud.setTimer(Math.ceil(blitzStartMs / 1000));
		this.title.hide();
		this.overlay.hide();
		this.sfx.stopMeadow();
		this.hud.setVisible(true);
		this.board.setPlayfieldVisible(true);
		this.sfx.resetMatch();
		this.refresh();
		this.beginCountdown();
	}

	private stopCountdown(): void {
		this.countEvent?.remove(false);
		this.countEvent = undefined;
		this.countingIn = false;
		this.countText?.setVisible(false);
	}

	private beginCountdown(): void {
		this.stopCountdown();
		this.countingIn = true;
		this.countText?.setPosition(this.scale.width / 2, this.scale.height / 2);
		const step = (index: number): void => {
			if (!this.countingIn) {
				return;
			}
			const beat = countdownBeats[index];
			if (!beat) {
				this.stopCountdown();
				this.clockStartedAt = this.time.now;
				this.refresh();
				return;
			}
			this.countText?.setText(beat).setVisible(true);
			this.countEvent = this.time.delayedCall(countdownBeatMs, () => {
				step(index + 1);
			});
		};
		step(0);
	}

	private layout(width: number, height: number): void {
		this.board.layout(width, height);
		this.hud.layout(width, height);
		this.overlay.layout(width, height);
		this.title.layout(width, height);
		this.countText?.setPosition(width / 2, height / 2);
		this.refresh();
	}

	private matchSeconds(): number {
		if (this.phase === 'title' || this.phase === 'over') {
			return Math.ceil(this.clocks.white / 1000);
		}
		const side = this.position.turn;
		const left = remainingMs(
			this.clocks[side],
			this.clockStartedAt,
			this.time.now,
			this.paused,
		);
		return Math.ceil(left / 1000);
	}

	private settleClock(mover: Side): void {
		const left = remainingMs(
			this.clocks[mover],
			this.clockStartedAt,
			this.time.now,
			this.paused,
		);
		this.clocks[mover] = afterMoveBank(left);
		this.clockStartedAt = this.time.now;
	}

	private tickClock(): void {
		if (this.phase === 'title') {
			return;
		}
		if (this.countingIn) {
			this.hud.setTimer(Math.ceil(blitzStartMs / 1000));
			return;
		}
		this.hud.setTimer(this.matchSeconds());
		if (
			this.paused ||
			this.moving ||
			this.flagLock ||
			this.countingIn ||
			this.phase === 'over'
		) {
			return;
		}
		const side = this.position.turn;
		const left = remainingMs(
			this.clocks[side],
			this.clockStartedAt,
			this.time.now,
			false,
		);
		if (left <= 0) {
			this.onFlag();
		}
	}

	private onFlag(): void {
		if (this.flagLock || this.moving || this.countingIn || this.phase === 'over') {
			return;
		}
		this.flagLock = true;
		const { next, victim } = explodeFlag(this.position);
		const finish = (): void => {
			this.position = next;
			this.clocks[next.turn] = afterFlagBank();
			this.clockStartedAt = this.time.now;
			this.flagLock = false;
			const side = winner(this.position);
			if (side) {
				this.endMatch(side);
				return;
			}
			this.refresh();
		};
		if (!victim) {
			finish();
			return;
		}
		this.sfx.land(true);
		this.board.playFlagBurst(victim, finish);
	}

	private refresh(): void {
		if (this.phase === 'title') {
			this.hud.setTurn('');
			return;
		}
		this.board.sync(
			this.position,
			this.humanHighlights(),
			this.selected,
			this.optionMoves(),
		);
		if (this.phase === 'human') {
			this.hud.setTurn('Ваш ход');
		} else if (this.phase === 'bot') {
			this.hud.setTurn('Ход соперника');
		} else {
			this.hud.setTurn('');
		}
		this.maybeAutoMove();
	}

	private maybeAutoMove(): void {
		if (
			this.paused ||
			this.moving ||
			this.flagLock ||
			this.countingIn ||
			this.phase !== 'human'
		) {
			return;
		}
		if (!getAutoMove()) {
			return;
		}
		const moves = legalMoves(this.position);
		if (moves.length === 1) {
			this.playHuman(moves[0]);
		}
	}

	private optionMoves(): IMove[] {
		if (this.phase !== 'human' || this.paused || this.countingIn) {
			return [];
		}
		return hopMovesForSelection(legalMoves(this.position), this.selected);
	}

	private humanHighlights(): ISquare[] {
		if (this.phase !== 'human' || this.paused || this.countingIn) {
			return [];
		}
		const moves = legalMoves(this.position);
		const selected = this.selected;
		if (selected) {
			return uniqueSquares(
				moves
					.filter((move) => sameSquare(move.from, selected))
					.map((move) => move.path[move.path.length - 1]),
			);
		}
		return uniqueSquares(moves.map((move) => move.from));
	}

	private onSquare(square: ISquare): void {
		if (
			this.paused ||
			this.moving ||
			this.flagLock ||
			this.countingIn ||
			this.phase !== 'human'
		) {
			return;
		}
		const moves = legalMoves(this.position);
		const selected = this.selected;
		if (selected) {
			const chosen = moves.find(
				(move) =>
					sameSquare(move.from, selected) &&
					sameSquare(move.path[move.path.length - 1], square),
			);
			if (chosen) {
				this.playHuman(chosen);
				return;
			}
		}
		if (moves.some((move) => sameSquare(move.from, square))) {
			this.selected = square;
			this.sfx.selectThenHover();
			this.refresh();
			return;
		}
		const piece = this.position.squares[square.row][square.col];
		const denied = Boolean(piece && piece.side === this.position.turn);
		this.selected = null;
		this.sfx.stopHover();
		this.refresh();
		if (denied) {
			this.board.deny(square);
		}
	}

	private animateMove(move: IMove, after: () => void): void {
		this.moving = true;
		this.selected = null;
		this.board.sync(this.position, [], null);
		this.board.playMove(
			move,
			() => {
				this.moving = false;
				after();
			},
			(took) => {
				this.sfx.land(took);
			},
			(took) => {
				this.sfx.takeoff(took);
			},
		);
	}

	private playHuman(move: IMove): void {
		this.animateMove(move, () => {
			const mover = this.position.turn;
			const next = apply(this.position, move);
			if (!next) {
				return;
			}
			this.settleClock(mover);
			this.position = next;
			const side = winner(this.position);
			if (side) {
				this.endMatch(side);
				return;
			}
			this.phase = 'bot';
			this.refresh();
			this.botTimer?.remove(false);
			this.botTimer = this.time.delayedCall(400, () => {
				this.playBot();
			});
		});
	}

	private playBot(): void {
		if (this.paused) {
			this.pendingBot = true;
			return;
		}
		if (this.phase !== 'bot' || this.moving) {
			return;
		}
		this.pendingBot = false;
		const move = pickBotMove(this.position);
		if (!move) {
			this.endMatch(winner(this.position) ?? 'white');
			return;
		}
		this.animateMove(move, () => {
			const mover = this.position.turn;
			const next = apply(this.position, move);
			if (!next) {
				this.endMatch(winner(this.position) ?? 'white');
				return;
			}
			this.settleClock(mover);
			this.position = next;
			const side = winner(this.position);
			if (side) {
				this.endMatch(side);
				return;
			}
			this.phase = 'human';
			this.refresh();
		});
	}

	private resignMatch(): void {
		if (this.paused || this.moving || this.flagLock || this.phase !== 'human') {
			return;
		}
		this.phase = 'over';
		this.selected = null;
		this.sfx.stopHover();
		this.refresh();
		this.overlay.show('black');
	}

	private endMatch(side: Side): void {
		this.phase = 'over';
		this.selected = null;
		this.refresh();
		this.sdk.showFullscreenAdv({
			onClose: () => {
				this.overlay.show(side);
			},
			onError: () => {
				this.overlay.show(side);
			},
		});
	}

	private setPaused(paused: boolean): void {
		if (paused === this.paused) {
			return;
		}
		if (paused) {
			const side = this.position.turn;
			this.clocks[side] = remainingMs(
				this.clocks[side],
				this.clockStartedAt,
				this.time.now,
				false,
			);
			this.elapsedMs += this.time.now - this.runningSince;
		} else {
			this.runningSince = this.time.now;
			this.clockStartedAt = this.time.now;
		}
		this.paused = paused;
		this.sound.mute = paused;
		this.sfx.setPaused(paused);
		if (paused) {
			this.tweens.pauseAll();
		} else {
			this.tweens.resumeAll();
		}
		if (!paused && this.pendingBot) {
			this.playBot();
		}
	}
}

function uniqueSquares(squares: ISquare[]): ISquare[] {
	const seen = new Set<string>();
	const unique: ISquare[] = [];
	for (const square of squares) {
		const key = `${square.row},${square.col}`;
		if (seen.has(key)) {
			continue;
		}
		seen.add(key);
		unique.push(square);
	}
	return unique;
}
