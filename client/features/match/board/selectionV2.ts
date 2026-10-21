/** V2 export uses Python round: exact half displacements choose the even integer. */
export function selectionV2Frame(progress: number): number {
 const value=Math.max(0,Math.min(1,progress))*55;
 const low=Math.floor(value),fraction=value-low;
 return fraction===.5 ? low+low%2 : Math.round(value);
}
