type Sample = { received: number; roundTrip: number; offset: number };

export class ClockSync {
	private samples: Sample[] = [];
	reset(): void {
		this.samples = [];
	}
	record(sent: number, received: number, serverReceived: number, serverSent: number): boolean {
		if (![sent, received, serverReceived, serverSent].every(Number.isFinite)) return false;
		const processing = serverSent - serverReceived;
		const roundTrip = received - sent - processing;
		if (processing < 0 || roundTrip < -2 || received < sent || received - sent > 5000) return false;
		this.samples = this.samples.filter(sample => received - sample.received < 60_000).slice(-6);
		this.samples.push({ received, roundTrip: Math.max(0, roundTrip), offset: (serverReceived - sent + serverSent - received) / 2 });
		return true;
	}
	age(serverSent: number, received: number): number {
		const recent = this.samples.filter(sample => received - sample.received < 60_000 && received >= sample.received);
		if (recent.length < 3 || !Number.isFinite(serverSent)) return 0;
		const best = recent.reduce((first, second) => first.roundTrip <= second.roundTrip ? first : second);
		return Math.max(0, Math.min(5000, received + best.offset - serverSent));
	}
}
