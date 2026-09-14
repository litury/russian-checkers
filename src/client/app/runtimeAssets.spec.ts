import resultSource from './resultOverlay.ts?raw';
import { layout, pieceSprites } from '@/client/config/layout';
import source from './gameScene.ts?raw';
import { describe, expect, it } from 'vitest';

describe('Reliquary startup budget', () => {
 it('retires audio and old HUD loaders, not live bunker/result art', () => {
  expect(source).not.toMatch(/modules\/sfx|this\.sfx|load\.audio|this\.load\.image\('hud/);
  expect(source).toContain('preloadBunkerPanels(this)');
  expect(source).toContain('checkerDefeat_');
 });
 it('does not queue textures consumed only by the retired meadow renderer', () => {
  expect(source).not.toMatch(/this\.load\.image\(\s*(?:tableLayers|hamsterSprites|rabbitSprites|beeSprites|pitSprites|debrisSprites|wreathSprites|pathSprites|fireSprites|captureSprites)\./);
 });
});

describe('audited remaining retired resources', () => {
 it('has no retired texture loader or hidden result consumer', () => {
  for (const key of ["hudPlateVol", "hudSliderKnob", "hudActionMoat", "hudResign", "hudResignWave", "resultGlassMeadow", "mascotIdle", "mascotLose0", "mascotLose1", "mascotLose2", "mascotLose3", "mascotLose4", "mascotLose5", "resultGlassLose"]) {
   expect(source).not.toContain("'" + key + "'");
   expect(resultSource).not.toContain("'" + key + "'");
  }
 });
 it('has no obsolete layout or rim configuration', () => {
  for (const key of ["statusHeight", "hudAction", "hudStripInset", "pieceRadiusRatio", "kingMarkRatio", "highlightAlpha", "debugGrid", "pressScaleY", "liftRatio", "selectMs", "moveMs", "anticipateMs", "landHoldMs", "hitStopMs", "captureBurstMs", "captureShardCount", "scorchPitScale", "scorchFadeInMs", "afterimageMs", "hopArcRatio", "hopDashPxPerSec", "markerFadeMs", "markerBreathMin", "markerBreathMax", "markerBreathMs", "shadowAlpha", "minCellPx", "framePadPx", "pitFit", "pieceFit", "hudResign"]) expect(layout).not.toHaveProperty(key);
  for (const key of ["selectRim", "moveRim", "captureRim"]) expect(pieceSprites).not.toHaveProperty(key);
 });
});
