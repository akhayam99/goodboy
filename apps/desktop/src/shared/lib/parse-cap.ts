export const parseCap = (raw: string): number | null => {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  const parsed = parseFloat(trimmed);
  if (!isFinite(parsed) || parsed <= 0) return null;
  return parsed;
};
