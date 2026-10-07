const PARTS_HEADING_RE = /^(#{1,3})\s+parts\s*$/i;
const HEADING_RE = /^(#{1,6})\s/;

export const dropPartsSection = ({ text }: { readonly text: string }): string => {
  const kept: string[] = [];
  let skippedLevel = 0;
  for (const line of text.split('\n')) {
    const heading = HEADING_RE.exec(line);
    if (skippedLevel > 0) {
      if (heading === null || (heading[1] ?? '').length > skippedLevel) {
        continue;
      }
      skippedLevel = 0;
    }
    const parts = PARTS_HEADING_RE.exec(line.trim());
    if (parts !== null) {
      skippedLevel = (parts[1] ?? '').length;
      continue;
    }
    kept.push(line);
  }
  return kept.join('\n').replace(/^\n+/, '');
};
