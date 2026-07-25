/** "4.2s", "3m 12s", "1h 05m" — for time-on-page / session durations. */
export function formatDuration(ms: number): string {
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${String(Math.round(seconds % 60)).padStart(2, '0')}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${String(minutes % 60).padStart(2, '0')}m`;
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Default dashboard range: the last 30 days, as yyyy-mm-dd input values. */
export function defaultDateRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

/** yyyy-mm-dd input values → inclusive full-day ISO bounds for the API. */
export function toApiRange(from: string, to: string): { from: string; to: string } {
  return {
    from: new Date(`${from}T00:00:00.000Z`).toISOString(),
    to: new Date(`${to}T23:59:59.999Z`).toISOString(),
  };
}
