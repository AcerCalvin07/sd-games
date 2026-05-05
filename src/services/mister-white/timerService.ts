export function getRemainingSeconds(startedAtUnix: number, durationSeconds: number): number {
  const nowUnix = Math.floor(Date.now() / 1000);
  const elapsed = nowUnix - startedAtUnix;
  const remaining = durationSeconds - elapsed;
  return Math.max(0, remaining);
}

export function isTimerExpired(startedAtUnix: number, durationSeconds: number): boolean {
  return getRemainingSeconds(startedAtUnix, durationSeconds) === 0;
}
