export interface InstagramClient {
  /**
   * Returns follower count samples for the given [sinceMs, untilMs) range.
   * The engine will interpret the last available sample in-range as "end of month".
   */
  getFollowerCountSeries(options: { sinceMs: number; untilMs: number }): Promise<Array<{ endTimeIso: string; value: number }>>;
}

export class InstagramUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InstagramUnavailableError';
  }
}
