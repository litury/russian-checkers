export function defeatTerminalLayout(width: number, height: number) {
 const scale = Math.min(width >= 460 ? 1.5 : 1, (width-24)/324, (height-24)/432);
 const x = (width-324*scale)/2;
 const y = (height-432*scale)/2;
 const buttonHeight = Math.max(44,44*scale);
 const primaryY = y+320*scale;
 const secondaryY = Math.max(y+364*scale,primaryY+buttonHeight);
 return {x,y,scale,buttons:[
  {x:x+43*scale,y:primaryY,width:238*scale,height:buttonHeight},
  {x:x+43*scale,y:secondaryY,width:238*scale,height:buttonHeight},
 ]};
}
