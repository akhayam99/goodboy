import type { SlashCommand } from '@goodboy/types';

const NAME_PATTERN = /^[a-z][a-z0-9-]*$/;

function tokenize(argsStr: string): ReadonlyArray<string> {
  const tokens: string[] = [];
  let i = 0;
  const s = argsStr.trim();

  while (i < s.length) {
    if (s[i] === ' ' || s[i] === '\t') {
      i++;
      continue;
    }

    if (s[i] === '"' || s[i] === "'") {
      const quote = s[i];
      i++;
      let token = '';
      while (i < s.length && s[i] !== quote) {
        token += s[i];
        i++;
      }
      i++;
      tokens.push(token);
    } else {
      let token = '';
      while (i < s.length && s[i] !== ' ' && s[i] !== '\t') {
        token += s[i];
        i++;
      }
      tokens.push(token);
    }
  }

  return tokens;
}

export const parseSlashCommand = (input: string): SlashCommand | null => {
  const lines = input.split('\n');
  const firstNonEmpty = lines.find((l) => l.trim().length > 0);

  if (firstNonEmpty === undefined) {
    return null;
  }

  const trimmed = firstNonEmpty.trim();

  if (!trimmed.startsWith('/')) {
    return null;
  }

  const rest = trimmed.slice(1);
  if (rest.length === 0) {
    return null;
  }

  const spaceIdx = rest.search(/[\s]/);
  const name = spaceIdx === -1 ? rest : rest.slice(0, spaceIdx);

  if (!NAME_PATTERN.test(name)) {
    return null;
  }

  const argsStr = spaceIdx === -1 ? '' : rest.slice(spaceIdx);
  const args = argsStr.trim().length === 0 ? [] : tokenize(argsStr);

  return { name, args, raw: trimmed };
};
