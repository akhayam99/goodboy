const FMT = new Intl.DateTimeFormat(undefined, {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

/** Format an ISO-8601 timestamp string as a localised HH:MM:SS string. */
export function formatCardTime(isoAt: string): string {
  return FMT.format(new Date(isoAt));
}
