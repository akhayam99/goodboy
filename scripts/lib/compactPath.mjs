const ARITY = { m: 2, l: 2, h: 1, v: 1, c: 6, s: 4, q: 4, t: 2, a: 7, z: 0 };
const TOKEN = /[MLHVCSQTAZmlhvcsqtaz]|-?(?:\d+\.?\d*|\.\d+)/g;
const ARC_FIXED = 5;

const segmentsOf = ({ d }) => {
  const segments = [];
  let command = null;
  for (const token of d.match(TOKEN) ?? []) {
    if (/[a-z]/i.test(token)) {
      command = { letter: token, numbers: [] };
      segments.push(command);
      continue;
    }
    command.numbers.push(Number(token));
  }
  return segments.flatMap(({ letter, numbers }) => {
    const arity = ARITY[letter.toLowerCase()];
    if (arity === 0) {
      return [{ letter, values: [] }];
    }
    const chunks = [];
    for (let index = 0; index < numbers.length; index += arity) {
      const isFollowingMove = index > 0 && letter.toLowerCase() === 'm';
      const followLetter = letter === 'm' ? 'l' : 'L';
      chunks.push({
        letter: isFollowingMove ? followLetter : letter,
        values: numbers.slice(index, index + arity),
      });
    }
    return chunks;
  });
};

const isYIndex = ({ kind, index }) => {
  if (kind === 'v') {
    return true;
  }
  if (kind === 'h') {
    return false;
  }
  if (kind === 'a') {
    return index === 6;
  }
  return index % 2 === 1;
};

const isPoint = ({ kind, index }) => kind !== 'a' || index >= ARC_FIXED;

const joinNumbers = ({ numbers }) =>
  numbers.reduce((text, value) => {
    const part = String(Object.is(value, -0) ? 0 : value);
    if (text === '' || part.startsWith('-')) {
      return text + part;
    }
    return `${text},${part}`;
  }, '');

export const compactPath = ({ d }) => {
  const exact = { x: 0, y: 0 };
  const rounded = { x: 0, y: 0 };
  const start = { exact: { x: 0, y: 0 }, rounded: { x: 0, y: 0 } };
  let out = '';
  for (const { letter, values } of segmentsOf({ d })) {
    const kind = letter.toLowerCase();
    if (kind === 'z') {
      out += 'z';
      Object.assign(exact, start.exact);
      Object.assign(rounded, start.rounded);
      continue;
    }
    const isRelative = letter === kind;
    const absolute = values.map((value, index) => {
      if (!isPoint({ kind, index }) || !isRelative) {
        return value;
      }
      return value + (isYIndex({ kind, index }) ? exact.y : exact.x);
    });
    const kept = absolute.map((value) => Math.round(value));
    const relative = kept.map((value, index) => {
      if (!isPoint({ kind, index })) {
        return value;
      }
      return value - (isYIndex({ kind, index }) ? rounded.y : rounded.x);
    });
    const relativeText = kind + joinNumbers({ numbers: relative });
    const absoluteText = kind.toUpperCase() + joinNumbers({ numbers: kept });
    out += relativeText.length <= absoluteText.length ? relativeText : absoluteText;
    if (kind === 'h') {
      exact.x = absolute[0];
      rounded.x = kept[0];
      continue;
    }
    if (kind === 'v') {
      exact.y = absolute[0];
      rounded.y = kept[0];
      continue;
    }
    exact.x = absolute[absolute.length - 2];
    exact.y = absolute[absolute.length - 1];
    rounded.x = kept[kept.length - 2];
    rounded.y = kept[kept.length - 1];
    if (kind === 'm') {
      start.exact = { ...exact };
      start.rounded = { ...rounded };
    }
  }
  return out;
};
