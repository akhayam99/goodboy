const PARTS = [
  ['screensAdded', 'screen added', 'screens added'],
  ['screensChanged', 'screen changed', 'screens changed'],
  ['screensRemoved', 'screen removed', 'screens removed'],
  ['added', 'element added', 'elements added'],
  ['changed', 'element changed', 'elements changed'],
  ['removed', 'element removed', 'elements removed'],
  ['statesAdded', 'state added', 'states added'],
] as const;

export const versionSummaryText = ({
  summary,
}: {
  readonly summary: Readonly<Record<string, number>> | null;
}): string | null => {
  if (summary === null) {
    return null;
  }
  const parts = PARTS.flatMap(([key, one, many]) => {
    const count = summary[key] ?? 0;
    return count === 0 ? [] : [`${count} ${count === 1 ? one : many}`];
  });
  return parts.length === 0 ? null : parts.join(' · ');
};
