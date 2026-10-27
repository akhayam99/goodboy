const DIRECT_CALLS = ['stubStoryInvoke'];
const OPTION_CALLS = ['createInvokeRouter', 'createInvokeMock'];
const HANDLER_TABLES = ['storyInvokeHandlers'];
const OPENERS = { '(': ')', '[': ']', '{': '}' };
const CLOSERS = new Set([')', ']', '}']);
const IDENTIFIER = /[A-Za-z_$][\w$]*/y;

const skipQuoted = ({ text, at }) => {
  const quote = text[at];
  let index = at + 1;
  while (index < text.length && text[index] !== quote) {
    index += text[index] === '\\' ? 2 : 1;
  }
  return index + 1;
};

const matchingClose = ({ text, open }) => {
  let depth = 0;
  let index = open;
  while (index < text.length) {
    const char = text[index];
    if (char === "'" || char === '"' || char === '`') {
      index = skipQuoted({ text, at: index });
      continue;
    }
    if (char in OPENERS) {
      depth += 1;
    }
    if (CLOSERS.has(char)) {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
    index += 1;
  }
  return -1;
};

const keyAt = ({ text, at }) => {
  const char = text[at];
  if (char === "'" || char === '"') {
    const end = skipQuoted({ text, at });
    return { key: text.slice(at + 1, end - 1), end };
  }
  IDENTIFIER.lastIndex = at;
  const match = IDENTIFIER.exec(text);
  return match === null ? null : { key: match[0], end: at + match[0].length };
};

export const objectEntries = ({ text, open }) => {
  const close = matchingClose({ text, open });
  if (close < 0) {
    return [];
  }
  const entries = [];
  let index = open + 1;
  while (index < close) {
    const char = text[index];
    if (/[\s,]/.test(char)) {
      index += 1;
      continue;
    }
    if (text.startsWith('...', index)) {
      index += 3;
      while (index < close && text[index] !== ',') {
        index += text[index] in OPENERS ? matchingClose({ text, open: index }) - index + 1 : 1;
      }
      continue;
    }
    const read = keyAt({ text, at: index });
    if (read === null) {
      index += 1;
      continue;
    }
    let cursor = read.end;
    while (/\s/.test(text[cursor] ?? '')) {
      cursor += 1;
    }
    const isProperty = text[cursor] === ':';
    const isMethod = text[cursor] === '(';
    if (isProperty || isMethod) {
      entries.push({ key: read.key, valueAt: isProperty ? cursor + 1 : cursor });
    }
    while (cursor < close && text[cursor] !== ',') {
      if (text[cursor] === "'" || text[cursor] === '"' || text[cursor] === '`') {
        cursor = skipQuoted({ text, at: cursor });
        continue;
      }
      cursor += text[cursor] in OPENERS ? matchingClose({ text, open: cursor }) - cursor + 1 : 1;
    }
    index = cursor + 1;
  }
  return entries;
};

const firstNonSpace = ({ text, from }) => {
  let index = from;
  while (index < text.length && /\s/.test(text[index])) {
    index += 1;
  }
  return index;
};

const handlerKeys = ({ text, open, isDirect }) => {
  const entries = objectEntries({ text, open });
  if (isDirect) {
    return entries.map((entry) => entry.key);
  }
  const handlers = entries.find((entry) => entry.key === 'handlers');
  if (handlers === undefined) {
    return [];
  }
  const valueAt = firstNonSpace({ text, from: handlers.valueAt });
  return text[valueAt] === '{'
    ? objectEntries({ text, open: valueAt }).map((entry) => entry.key)
    : [];
};

export const stubCommandNames = ({ source }) => {
  const names = new Set();
  for (const call of [...DIRECT_CALLS, ...OPTION_CALLS]) {
    const isDirect = DIRECT_CALLS.includes(call);
    for (const match of source.matchAll(new RegExp(`(?<![\\w$.])${call}\\s*\\(`, 'g'))) {
      const open = firstNonSpace({ text: source, from: match.index + match[0].length });
      if (source[open] === '{') {
        handlerKeys({ text: source, open, isDirect }).forEach((key) => names.add(key));
      }
    }
  }
  for (const table of HANDLER_TABLES) {
    for (const match of source.matchAll(new RegExp(`\\bconst ${table}\\b[^=]*=\\s*\\{`, 'g'))) {
      const open = match.index + match[0].length - 1;
      objectEntries({ text: source, open }).forEach((entry) => names.add(entry.key));
    }
  }
  return names;
};
