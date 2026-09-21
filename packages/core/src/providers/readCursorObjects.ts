type Params = {
  readonly stdout: string;
};

export const readCursorObjects = ({ stdout }: Params): ReadonlyArray<Record<string, unknown>> => {
  const objects: Record<string, unknown>[] = [];
  const closingDelimiters: string[] = [];
  let candidate = '';
  let isReadingObject = false;
  let isInsideString = false;
  let isEscaped = false;

  for (let index = 0; index < stdout.length; index += 1) {
    const character = stdout[index] ?? '';
    if (!isReadingObject) {
      if (character !== '{') {
        continue;
      }
      isReadingObject = true;
      closingDelimiters.push('}');
      candidate = character;
      continue;
    }

    if (isInsideString) {
      if (character === '\n') {
        candidate += '\\n';
        isEscaped = false;
        continue;
      }
      if (character === '\r') {
        candidate += '\\r';
        isEscaped = false;
        continue;
      }
      if (character === '\t') {
        candidate += '\\t';
        isEscaped = false;
        continue;
      }

      candidate += character;
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

    candidate += character;
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
      candidate = '';
      closingDelimiters.length = 0;
      isReadingObject = false;
      isInsideString = false;
      isEscaped = false;
      continue;
    }

    closingDelimiters.pop();
    if (closingDelimiters.length > 0) {
      continue;
    }

    let parsed: unknown = null;
    try {
      parsed = JSON.parse(candidate);
    } catch {
      parsed = null;
    }
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      objects.push(parsed as Record<string, unknown>);
    }
    candidate = '';
    isReadingObject = false;
    isInsideString = false;
    isEscaped = false;
  }

  return objects;
};
