export function defeatButtonState(index: number, down: boolean) {
 return { key: `defeat_${index === 0 ? 'primary' : 'secondary'}_${down ? 'pressed' : 'rest'}`, textY: down ? (index === 0 ? 3 : 2) : 0 };
}
