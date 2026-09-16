import { orcArenaLine } from './orcTurn';

export const elfArenaLine = 'elf-k-boyu';

const elfCues: Record<string, string> = {
 [orcArenaLine]: elfArenaLine,
 'tvoy-hod': 'elf-tvoy-hod',
 'time-low': 'elf-time-low',
 'time-up': 'elf-time-up',
 victory: 'elf-victory',
 defeat: 'elf-defeat',
};

export function announcerCue(humanSide: 'white' | 'black', name: string): string {
 if (humanSide === 'black') return name;
 return elfCues[name] ?? name;
}
