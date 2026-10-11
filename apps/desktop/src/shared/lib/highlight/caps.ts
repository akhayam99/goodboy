export const MAX_HIGHLIGHT_LINES = 5000;
export const MAX_HIGHLIGHT_LINE_LENGTH = 1000;

export const exceedsHighlightCap = (code: string): boolean => {
  let lines = 1;
  let lineStart = 0;
  for (let i = 0; i < code.length; i++) {
    if (code.charCodeAt(i) !== 10) {
      continue;
    }
    if (i - lineStart > MAX_HIGHLIGHT_LINE_LENGTH) {
      return true;
    }
    lines += 1;
    lineStart = i + 1;
    if (lines > MAX_HIGHLIGHT_LINES) {
      return true;
    }
  }
  return code.length - lineStart > MAX_HIGHLIGHT_LINE_LENGTH;
};
