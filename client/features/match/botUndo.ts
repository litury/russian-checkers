export function canUndoBot(online: boolean, depth: number): boolean {
 return !online && depth > 0;
}
