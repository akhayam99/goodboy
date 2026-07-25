type Params = {
  readonly raw: string;
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

  const edgeFence = /^```(?:json)?\s*([\s\S]*?)\s*```\s*$/i.exec(trimmed);
  if (edgeFence?.[1] != null && edgeFence[1] !== '') {
    return edgeFence[1].trim();
  }

  const balanced = extractBalancedJsonObject(trimmed);
  if (balanced !== null) {
    return balanced;
  }

  const innerFence = /```(?:json)?\s*([\s\S]*?)\s*```/i.exec(trimmed);
  if (innerFence?.[1] != null && innerFence[1] !== '') {
    return innerFence[1].trim();
  }

  return trimmed;
};
