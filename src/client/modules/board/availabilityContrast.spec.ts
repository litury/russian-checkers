import {expect,it} from 'vitest';
import type Phaser from 'phaser';
import {drawReliquaryMarker} from './reliquaryMarkers';
function record(state:'available'|'selected') {
 const styles:number[][]=[], paths:number[][][]=[];let points:number[][]=[];
 const g={lineStyle:(...v:number[])=>styles.push(v),beginPath:()=>{points=[]},moveTo:(...p:number[])=>points.push(p),lineTo:(...p:number[])=>points.push(p),strokePath:()=>paths.push(points)};
 drawReliquaryMarker(g as unknown as Phaser.GameObjects.Graphics,{x:22,y:22,w:44,h:44},state);
 return {styles,paths};
}
it('draws opaque light corners with wider dark backing',()=>{
 const {styles,paths}=record('available');
 expect(styles).toHaveLength(8);expect(paths.every(p=>p.length===3)).toBe(true);
 expect(styles.every(s=>s[2]===1)).toBe(true);
 expect(styles[0][0]).toBeGreaterThan(styles[1][0]);
 expect(styles[1][0]).toBeGreaterThanOrEqual(2);
});
it('preserves the original four beveled selection corners, no full frame',()=>{
 const {paths,styles}=record('selected');
 expect(paths).toHaveLength(12);
 expect(paths.every(p=>p.length===3)).toBe(true);
 expect(styles[2][0]).toBe(2);
});
