const SIGNATURE_RE = /\n*<!-- goodboy-scribe:([0-9a-f]{8}) -->\s*$/;

const hashOf = ({ text }: { readonly text: string }): string => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
};

type BodyParams = {
  readonly body: string;
};

export const signScribeBody = ({ body }: BodyParams): string => {
  const text = body.replace(SIGNATURE_RE, '').trimEnd();
  return `${text}\n\n<!-- goodboy-scribe:${hashOf({ text })} -->`;
};

export const isUntouchedScribeBody = ({ body }: BodyParams): boolean => {
  const match = SIGNATURE_RE.exec(body);
  if (match === null) {
    return false;
  }
  const text = body.slice(0, match.index).trimEnd();
  return hashOf({ text }) === match[1];
};

const REFERENCE_LINE_RE = /^(?:closes|fixes|resolves|part of)\s+\S+/i;

export const referenceLinesOf = ({ body }: BodyParams): ReadonlyArray<string> =>
  body
    .replace(SIGNATURE_RE, '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => REFERENCE_LINE_RE.test(line));
