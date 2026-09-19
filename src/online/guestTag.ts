export function guestTag(id: string): string {
 const hex = id.replace(/[^0-9a-f]/gi, '').slice(0, 4).toLowerCase();
 return hex.length === 4 ? `· ${hex}` : '';
}
