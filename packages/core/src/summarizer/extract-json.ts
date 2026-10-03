type Params = {
  readonly raw: string;
};

const FENCE = '```';
const JSON_TAG = 'json';

const skipWhitespace = (text: string, from: number): number => {
  let index = from;
  while (index < text.length && text.charAt(index).trim() === '') {
    index++;
  }
  return index;
};

const fenceBodyStart = (text: string, fenceAt: number): number => {
  const afterFence = fenceAt + FENCE.length;
  const tagEnd = afterFence + JSON_TAG.length;
  const hasTag = text.slice(afterFence, tagEnd).toLowerCase() === JSON_TAG;
  return skipWhitespace(text, hasTag ? tagEnd : afterFence);
};

const nonEmpty = (body: string): string | null => (body === '' ? null : body);

const extractEdgeFence = (text: string): string | null => {
  if (text.length < FENCE.length * 2 || !text.startsWith(FENCE) || !text.endsWith(FENCE)) {
    return null;
  }
  const start = fenceBodyStart(text, 0);
  return nonEmpty(text.slice(start, text.length - FENCE.length).trim());
};

const extractInnerFence = (text: string): string | null => {
  const open = text.indexOf(FENCE);
  if (open === -1) {
    return null;
  }
  const start = fenceBodyStart(text, open);
  const close = text.indexOf(FENCE, start);
  if (close === -1) {
    return null;
  }
  return nonEmpty(text.slice(start, close).trim());
};

const extractBalancedJsonObject = (text: string): string | null => {
  const start = text.indexOf('{');
  if (start === -1) {
    return null;
  }
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === '\\') {
        escaped = true;
        continue;
      }
      if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '{') {
      depth++;
      continue;
    }
    if (ch === '}') {
      depth--;
      if (depth === 0) {
        return text.slice(start, i + 1);
      }
    }
  }
  return null;
};

export const extractJson = ({ raw }: Params): string => {
  const trimmed = raw.trim();

  const edgeFence = extractEdgeFence(trimmed);
  if (edgeFence !== null) {
    return edgeFence;
  }

  const balanced = extractBalancedJsonObject(trimmed);
  if (balanced !== null) {
    return balanced;
  }

  const innerFence = extractInnerFence(trimmed);
  if (innerFence !== null) {
    return innerFence;
  }

  return trimmed;
};
