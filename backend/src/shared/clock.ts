/** Business rules take a Clock so tests control time. */
export interface Clock {
  now(): Date;
}

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}

export class FixedClock implements Clock {
  private ms: number;
  constructor(start: Date) {
    this.ms = start.getTime();
  }
  now(): Date {
    return new Date(this.ms);
  }
  advanceMs(ms: number): void {
    this.ms += ms;
  }
}
