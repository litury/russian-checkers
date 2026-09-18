export type MatchRow = {
 id: string;
 mode: 'bot' | 'online';
 winner: 'white' | 'black' | 'draw' | null;
 startedAt: string;
 color: 'white' | 'black';
 plies: number;
};

export type MatchDetail = MatchRow & {
 pliesList: { side: 'white' | 'black'; from: string; path: string[] }[];
};

export function ownColor(whiteId: string | null, blackId: string | null, me: string): 'white' | 'black' | null {
 if (whiteId === me) return 'white';
 if (blackId === me) return 'black';
 return null;
}

export function canOpenBoard(row: { plies: number }): boolean {
 return row.plies > 0;
}
