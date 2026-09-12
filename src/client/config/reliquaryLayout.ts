import {computeFieldLayout} from './fieldLayout';
export function reliquaryLayout(width:number,height:number) {
 const original=computeFieldLayout(width,height);
 const fieldSize=Math.max(8,Math.min(width-38, Math.floor(width*352/380), Math.floor(height*352/418), original.fieldSize-(original.portrait?0:66)));
 const scale=fieldSize/352;
 const originY=Math.max(33*scale,Math.min(original.originY+original.fieldSize-fieldSize,height-fieldSize-33*scale));
 return {...original,fieldSize,scale,cell:fieldSize/8,originX:(width-fieldSize)/2,originY};
}
