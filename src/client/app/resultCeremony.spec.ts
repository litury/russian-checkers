import {describe,it,expect} from 'vitest';
import {ceremonyPose} from './resultCeremony';
describe('rigid result ceremony timeline',()=>{
 it('contacts before descending and closes only after removal',()=>{
  expect(ceremonyPose(false,450)).toMatchObject({descent:0,doors:1,grip:0});
  expect(ceremonyPose(false,900)).toMatchObject({descent:0,grip:1,doors:1});
  expect(ceremonyPose(false,1500).descent).toBeGreaterThan(0);
  expect(ceremonyPose(false,2500)).toMatchObject({descent:200,doors:1});
  expect(ceremonyPose(false,3200)).toMatchObject({descent:200,doors:0,heat:0,done:true});
 });
 it('lifts the platform and exposes the authored resting mantle',()=>{
  expect(ceremonyPose(true,0)).toMatchObject({lift:0,light:0});
  expect(ceremonyPose(true,3200)).toMatchObject({lift:48,light:1,mantle:2,descent:0});
 });
 it('reduced motion is the exact static endpoint for both outcomes',()=>{
  for(const win of [true,false])expect(ceremonyPose(win,0,true)).toEqual(ceremonyPose(win,3200));
 });
});
