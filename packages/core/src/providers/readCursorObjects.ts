type Params = {
  readonly stdout: string;
};

type CandidateParams = {
  readonly stdout: string;
  readonly start: number;
};

type Candidate = {
  readonly text: string;
  readonly end: number;
};

const isCandidateStart = ({ stdout, start }: CandidateParams): boolean => {
  if (stdout[start] !== '{') {
    return false;
  }
  let index = start + 1;
  while (index < stdout.length && /\s/.test(stdout[index] ?? '')) {
    index += 1;
  }
  const next = stdout[index];
  return next === '"' || next === '}';
};

const findCandidateStart = ({ stdout, start }: CandidateParams): number => {
  for (let index = start; index < stdout.length; index += 1) {
    if (isCandidateStart({ stdout, start: index })) {
      return index;
    }
  }
  return -1;
};

const readCandidate = ({ stdout, start }: CandidateParams): Candidate | null => {
  const closingDelimiters: string[] = ['}'];
  let text = '{';
  let isInsideString = false;
  let isEscaped = false;

  for (let index = start + 1; index < stdout.length; index += 1) {
    const character = stdout[index] ?? '';

    if (isInsideString) {
      if (character === '\n') {
        text += '\\n';
        isEscaped = false;
        continue;
      }
      if (character === '\r') {
        text += '\\r';
        isEscaped = false;
        continue;
      }
      if (character === '\t') {
        text += '\\t';
        isEscaped = false;
        continue;
      }
      text += character;
      if (character === '\\') {
        isEscaped = !isEscaped;
        continue;
      }
      if (character === '"' && !isEscaped) {
        isInsideString = false;
      }
      isEscaped = false;
      continue;
    }

    text += character;
    if (character === '"') {
      isInsideString = true;
      isEscaped = false;
      continue;
    }
    if (character === '{') {
      closingDelimiters.push('}');
      continue;
    }
    if (character === '[') {
      closingDelimiters.push(']');
      continue;
    }
    if (character !== '}' && character !== ']') {
      continue;
    }
    if (closingDelimiters.at(-1) !== character) {
      return null;
    }
    closingDelimiters.pop();
    if (closingDelimiters.length === 0) {
      return { text, end: index + 1 };
    }
  }

  return null;
};

const parseCandidate = (text: string): Record<string, unknown> | null => {
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return null;
  }
  return parsed as Record<string, unknown>;
};

export const readCursorObjects = ({ stdout }: Params): ReadonlyArray<Record<string, unknown>> => {
  const objects: Record<string, unknown>[] = [];
  let cursor = 0;

  while (cursor < stdout.length) {
    const start = findCandidateStart({ stdout, start: cursor });
    if (start === -1) {
      break;
    }
    const candidate = readCandidate({ stdout, start });
    if (candidate === null) {
      cursor = start + 1;
      continue;
    }
    const parsed = parseCandidate(candidate.text);
    if (parsed === null) {
      cursor = start + 1;
      continue;
    }
    objects.push(parsed);
    cursor = candidate.end;
  }

  return objects;
};
