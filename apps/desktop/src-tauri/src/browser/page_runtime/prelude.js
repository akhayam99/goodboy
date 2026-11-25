const READ_EVENT = '__GOODBOY_CONSOLE_READ__';
const RING_SIZES = { console: 500, network: 300, error: 100 };
const KINDS = ['console', 'network', 'error'];
const MAX_TEXT = 2000;
const MAX_SOURCE = 200;
const MAX_PATH = 500;
const MAX_METHOD = 16;
const MAX_DEPTH = 2;
const MAX_KEYS = 20;
const MAX_STACK_LINE = 500;
const MAX_STACK = 4000;
const HOOK_FRAME = 'goodboyConsoleHook';
const ACL_HEAD = 'Command ';
const ACL_TAIL = ' not allowed by ACL';
const WINDOW_MARK = ' not allowed on window "';
const stringify = JSON.stringify;
const toText = String;
const tagOf = Object.prototype.toString;
const Url = window.URL;
const here = window.location;
const clock = window.performance;
const rings = { console: [], network: [], error: [] };
const doc = Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
let seq = 0;
let isBusy = false;

const clip = (text, max) => (text.length > max ? text.slice(0, max) : text);

const quietly = (work) => {
  try {
    work();
  } catch {
    return;
  }
};

const now = () => {
  try {
    return clock != null && typeof clock.now === 'function' ? Math.round(clock.now() * 10) / 10 : 0;
  } catch {
    return 0;
  }
};

const describe = (value, depth) => {
  try {
    if (typeof value === 'string') {
      return depth === 0 ? value : stringify(value);
    }
    if (value === null || value === undefined) {
      return toText(value);
    }
    if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
      return toText(value);
    }
    if (typeof value === 'symbol') {
      return value.toString();
    }
    if (typeof value === 'function') {
      return (
        'function ' +
        (typeof value.name === 'string' && value.name !== '' ? value.name : 'anonymous')
      );
    }
    if (tagOf.call(value) === '[object Error]') {
      return toText(value.name) + ': ' + toText(value.message);
    }
    if (typeof value.nodeName === 'string') {
      return '<' + value.nodeName.toLowerCase() + '>';
    }
    const isList = Array.isArray(value);
    if (depth >= MAX_DEPTH) {
      return isList ? '[...]' : '{...}';
    }
    const parts = [];
    if (isList) {
      const count = value.length < MAX_KEYS ? value.length : MAX_KEYS;
      for (let index = 0; index < count; index += 1) {
        parts[parts.length] = describe(value[index], depth + 1);
      }
      return '[' + parts.join(', ') + (value.length > MAX_KEYS ? ', ...' : '') + ']';
    }
    const keys = Object.keys(value);
    const count = keys.length < MAX_KEYS ? keys.length : MAX_KEYS;
    for (let index = 0; index < count; index += 1) {
      parts[parts.length] = keys[index] + ': ' + describe(value[keys[index]], depth + 1);
    }
    return '{' + parts.join(', ') + (keys.length > MAX_KEYS ? ', ...' : '') + '}';
  } catch {
    return '[unreadable]';
  }
};

const fileOf = (address) => {
  let file = toText(address);
  const query = file.indexOf('?');
  if (query >= 0) {
    file = file.slice(0, query);
  }
  const hash = file.indexOf('#');
  if (hash >= 0) {
    file = file.slice(0, hash);
  }
  const slash = file.lastIndexOf('/');
  return slash >= 0 ? file.slice(slash + 1) : file;
};

const isDigits = (text) => {
  if (text === '') {
    return false;
  }
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    if (code < 48 || code > 57) {
      return false;
    }
  }
  return true;
};

const sourceOfLine = (raw) => {
  let line = clip(toText(raw).trim(), MAX_STACK_LINE);
  if (line.endsWith(')')) {
    line = line.slice(0, -1);
  }
  const column = line.lastIndexOf(':');
  if (column <= 0) {
    return null;
  }
  const lineMark = line.lastIndexOf(':', column - 1);
  if (lineMark <= 0) {
    return null;
  }
  const number = line.slice(lineMark + 1, column);
  if (!isDigits(number) || !isDigits(line.slice(column + 1))) {
    return null;
  }
  let address = line.slice(0, lineMark);
  const open = address.lastIndexOf('(');
  const at = address.lastIndexOf('@');
  const space = address.lastIndexOf(' ');
  const start = Math.max(open, at, space);
  address = address.slice(start + 1);
  const file = fileOf(address);
  if (file === '') {
    return null;
  }
  return clip(file + ':' + number, MAX_SOURCE);
};

const linesAfter = (stack, marker) => {
  const lines = stack.split('\n');
  let first = 0;
  if (marker !== null) {
    for (let index = 0; index < lines.length; index += 1) {
      if (lines[index].indexOf(marker) >= 0) {
        first = index + 1;
      }
    }
  }
  return lines.slice(first);
};

const sourceOfStack = (stack, marker) => {
  if (typeof stack !== 'string') {
    return null;
  }
  const lines = linesAfter(stack, marker);
  for (let index = 0; index < lines.length; index += 1) {
    const source = sourceOfLine(lines[index]);
    if (source !== null) {
      return source;
    }
  }
  return null;
};

const stackOf = (stack, marker) => {
  if (typeof stack !== 'string') {
    return null;
  }
  const lines = linesAfter(stack, marker);
  const kept = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = clip(lines[index].trim(), MAX_STACK_LINE);
    if (line !== '') {
      kept[kept.length] = line;
    }
  }
  const text = clip(kept.join('\n'), MAX_STACK);
  return text === '' ? null : text;
};

const errorStackOf = (value) =>
  value != null && tagOf.call(value) === '[object Error]' ? stackOf(value.stack, null) : null;

const store = (entry) => {
  seq += 1;
  entry.seq = seq;
  const ring = rings[entry.kind];
  ring[ring.length] = entry;
  if (ring.length > RING_SIZES[entry.kind]) {
    ring.splice(0, ring.length - RING_SIZES[entry.kind]);
  }
};

const guarded = (work) => {
  if (isBusy) {
    return;
  }
  isBusy = true;
  quietly(work);
  isBusy = false;
};

const storeError = (origin, text, source, stack, requestId) =>
  store({
    kind: 'error',
    level: 'error',
    text: clip(text, MAX_TEXT),
    source,
    method: null,
    status: null,
    network: null,
    error: { origin, stack, requestId },
  });

const recordError = (origin, textOf, sourceOf, stackOfError) =>
  guarded(() => storeError(origin, textOf(), sourceOf(), stackOfError(), null));

const textOfArgs = (args) => {
  const parts = [];
  for (let index = 0; index < args.length; index += 1) {
    parts[parts.length] = describe(args[index], 0);
    if (parts.join(' ').length > MAX_TEXT) {
      break;
    }
  }
  return parts.join(' ');
};
