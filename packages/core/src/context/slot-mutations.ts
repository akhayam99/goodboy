export const mergeIntoSlot = (existing: string, additions: ReadonlyArray<string>): string => {
  if (additions.length === 0) {
    return existing;
  }
  const lines = existing.length > 0 ? existing.split('\n') : [];
  const seen = new Set(lines.map((l) => l.trim()));
  let changed = false;
  for (const add of additions) {
    const trimmed = add.trim();
    if (trimmed.length === 0) {
      continue;
    }
    if (seen.has(trimmed)) {
      continue;
    }
    seen.add(trimmed);
    lines.push(trimmed);
    changed = true;
  }
  return changed ? lines.join('\n') : existing;
};

export const removeFromSlot = (existing: string, removals: ReadonlyArray<string>): string => {
  if (removals.length === 0 || existing.length === 0) {
    return existing;
  }
  const norm = (s: string) =>
    s
      .replace(/^\s*(?:[-*]|\d+\.)\s+/, '')
      .trim()
      .toLowerCase();
  const targets = removals.map(norm).filter((s) => s.length > 0);
  if (targets.length === 0) {
    return existing;
  }
  const lines = existing.split('\n');
  const kept: string[] = [];
  let changed = false;
  for (const line of lines) {
    const n = norm(line);
    if (n.length === 0) {
      kept.push(line);
      continue;
    }
    const matches = targets.some((t) => n === t || n.includes(t) || t.includes(n));
    if (matches) {
      changed = true;
      continue;
    }
    kept.push(line);
  }
  return changed ? kept.join('\n') : existing;
};
