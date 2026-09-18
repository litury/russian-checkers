export function mintFriendCode(taken: Set<string>, rnd: () => number = Math.random): string {
 for (let i = 0; i < 50; i += 1) {
  const code = String(Math.floor(rnd() * 1_000_000)).padStart(6, '0');
  if (!taken.has(code)) return code;
 }
 return String(Date.now() % 1_000_000).padStart(6, '0');
}

export function resolveFriendJoin(token: string, codes: Map<string, string>): string | undefined {
 const t = token.trim();
 if (/^\d{6}$/.test(t)) return codes.get(t);
 return t || undefined;
}
