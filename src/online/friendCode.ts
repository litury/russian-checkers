export function mintFriendCode(taken: Set<string>, rnd: () => number = Math.random): string {
 for (let i = 0; i < 50; i += 1) {
  const code = String(Math.floor(rnd() * 1_000_000)).padStart(6, '0');
  if (code === '000000' || taken.has(code)) continue;
  return code;
 }
 return String(Date.now() % 1_000_000).padStart(6, '0');
}

export function resolveFriendJoin(token: string, codes: Map<string, string>): string | undefined {
 const t = token.trim();
 if (t === '000000') return undefined;
 if (/^\d{6}$/.test(t)) return codes.get(t);
 return t || undefined;
}
