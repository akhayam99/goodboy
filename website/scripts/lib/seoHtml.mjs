const RAW_TEXT = new Set(['script', 'style']);
const ATTRIBUTE = /([^\s"'=<>/]+)(?:="([^"]*)")?/g;

const closeOf = ({ html, from }) => {
  let quote = '';
  for (let index = from; index < html.length; index += 1) {
    const char = html[index];
    if (quote !== '') {
      quote = char === quote ? '' : quote;
    } else if (char === '"' || char === "'") {
      quote = char;
    } else if (char === '>') {
      return index;
    }
  }
  return -1;
};

const attributesOf = ({ source }) =>
  new Map([...source.matchAll(ATTRIBUTE)].map((match) => [match[1].toLowerCase(), match[2] ?? '']));

export const tagsOf = ({ html }) => {
  const tags = [];
  const lower = html.toLowerCase();
  let index = 0;
  while (index < html.length) {
    const open = html.indexOf('<', index);
    if (open === -1) {
      break;
    }
    if (html.startsWith('<!--', open)) {
      const end = html.indexOf('-->', open + 4);
      index = end === -1 ? html.length : end + 3;
      continue;
    }
    const next = html[open + 1] ?? '';
    const isClosing = next === '/';
    if (!/[A-Za-z/]/.test(next)) {
      index = open + 1;
      continue;
    }
    const close = closeOf({ html, from: open + 1 });
    if (close === -1) {
      break;
    }
    const inner = html.slice(open + (isClosing ? 2 : 1), close).replace(/\/$/, '');
    const nameEnd = inner.search(/[\s]/);
    const name = (nameEnd === -1 ? inner : inner.slice(0, nameEnd)).toLowerCase();
    const tag = {
      name,
      isClosing,
      attributes: isClosing
        ? new Map()
        : attributesOf({ source: nameEnd === -1 ? '' : inner.slice(nameEnd) }),
      start: open,
      end: close + 1,
      body: '',
    };
    index = close + 1;
    if (!isClosing && RAW_TEXT.has(name)) {
      const end = lower.indexOf(`</${name}`, index);
      const stop = end === -1 ? html.length : end;
      tag.body = html.slice(index, stop);
      index = stop;
    }
    tags.push(tag);
  }
  return tags;
};

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", '#x27': "'" };

const decode = ({ text }) =>
  text.replace(/&(amp|lt|gt|quot|#39|#x27);/g, (_, name) => ENTITIES[name]);

export const textOf = ({ html, tag }) => {
  const stop = html.indexOf('</', tag.end);
  return decode({ text: html.slice(tag.end, stop === -1 ? undefined : stop) });
};

export const decodeAttribute = ({ text }) => decode({ text });
