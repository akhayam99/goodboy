/**
 * Parse a raw soft-cap string entered by the user into a positive number.
 *
 * Returns `null` when the input is empty or contains only whitespace.
 * Returns `null` when the parsed value is not a finite positive number.
 * Returns the parsed number otherwise.
 */
export function parseCap(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  const parsed = parseFloat(trimmed);
  if (!isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}
