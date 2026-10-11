type Params = {
  readonly text: string;
  readonly heading: string;
};

export const sectionOf = ({ text, heading }: Params): { body: string; before: string } | null => {
  const lines = text.split('\n');
  let fence = '';
  let start = -1;
  let end = lines.length;
  for (const [index, line] of lines.entries()) {
    const trimmed = line.trimStart();
    const marker = /^(\x60{3,}|~{3,})/.exec(trimmed)?.[1];
    if (marker !== undefined) {
      if (fence === '') {
        fence = marker;
        continue;
      }
      if (marker[0] === fence[0] && marker.length >= fence.length && trimmed.trim() === marker) {
        fence = '';
      }
      continue;
    }
    if (fence !== '') {
      continue;
    }
    if (start >= 0 && /^#{1,2}\s/.test(trimmed)) {
      end = index;
      break;
    }
    if (trimmed.trim() === `## ${heading}` && start < 0) {
      start = index;
    }
  }
  if (start < 0) {
    return null;
  }
  return {
    body: lines
      .slice(start + 1, end)
      .join('\n')
      .trim(),
    before: lines.slice(0, start).join('\n').trim(),
  };
};
