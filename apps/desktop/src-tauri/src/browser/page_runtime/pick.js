const PICK_EVENT = READ_EVENT + ':pick';
const MAX_PICKS = 4;
const MAX_PICK_HTML = 4000;
const MAX_PICK_TEXT = 1000;
const MAX_PICK_SELECTOR = 300;
const MAX_PICK_NAME = 80;
const MAX_SELECTOR_DEPTH = 5;
const MAX_MAP_CHARS = 5000000;
const PICK_HOST_TAG = 'goodboy-picker';
const PICK_TINT = 'oklch(0.5 0.19 259)';
const PICK_STYLES = [
  'display',
  'position',
  'width',
  'height',
  'margin',
  'padding',
  'color',
  'background-color',
  'font-family',
  'font-size',
  'font-weight',
  'line-height',
  'border',
  'border-radius',
  'gap',
];
const PICK_BLOCKED = [
  'pointerdown',
  'pointerup',
  'mousedown',
  'mouseup',
  'dblclick',
  'contextmenu',
  'auxclick',
];
const HOST_STYLE = [
  'all: initial',
  'position: fixed',
  'inset: 0',
  'z-index: 2147483647',
  'display: block',
  'visibility: visible',
  'opacity: 1',
  'pointer-events: auto',
  'cursor: crosshair',
  'transform: none',
  'filter: none',
  'clip-path: none',
]
  .map((rule) => rule + ' !important')
  .join('; ');
const SHADOW_STYLE =
  ':host{all:initial}' +
  '*{box-sizing:border-box}' +
  '.box{position:fixed;pointer-events:none;border-radius:2px;box-shadow:0 0 0 2px ' +
  PICK_TINT +
  ';background:color-mix(in oklch,' +
  PICK_TINT +
  ' 8%,transparent)}' +
  '.box.picked{background:color-mix(in oklch,' +
  PICK_TINT +
  ' 16%,transparent)}' +
  '.tag{position:fixed;pointer-events:none;padding:2px 6px;border-radius:4px;background:' +
  PICK_TINT +
  ';color:#fff;font:500 11px/16px ui-monospace,SFMono-Regular,Menlo,monospace;white-space:nowrap}' +
  '.tag span{opacity:.8}' +
  '.hint{position:fixed;top:10px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:8px;height:30px;padding:0 6px 0 12px;border-radius:999px;background:#fff;color:#5b6170;box-shadow:0 0 0 1px rgba(0,0,0,.06),0 6px 20px rgba(0,0,0,.14);font:12px/16px system-ui,sans-serif;white-space:nowrap;pointer-events:none}' +
  '.hint b{color:#1d2230;font-weight:500}' +
  '.kbd{padding:1px 6px;border-radius:6px;background:rgba(0,0,0,.06);font:500 11px/16px ui-monospace,SFMono-Regular,Menlo,monospace}' +
  '@media (prefers-color-scheme: dark){.hint{background:#22252d;color:#a3a8b5;box-shadow:0 0 0 1px rgba(255,255,255,.08),0 6px 20px rgba(0,0,0,.4)}.hint b{color:#eceef2}.kbd{background:rgba(255,255,255,.1)}}';
const BASE64_MAP = 'base64,';
const MAP_MARK = '//# sourceMappingURL=';
const VLQ_DIGITS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const LOOPBACK_HOSTS = ['localhost', '127.0.0.1', '[::1]'];
const picker = {
  isOn: false,
  isLeft: false,
  round: 0,
  held: [],
  facts: [],
  hover: null,
  host: null,
  layer: null,
  isDrawPending: false,
};
const sourceMaps = new Map();

const isLoopbackPage = () => {
  const host = toText(here.hostname).toLowerCase();
  return LOOPBACK_HOSTS.indexOf(host) !== -1 || host.endsWith('.localhost');
};

const reactKeyOf = (element, prefix) => {
  const keys = Object.keys(element);
  for (let index = 0; index < keys.length; index += 1) {
    if (keys[index].indexOf(prefix) === 0) {
      return keys[index];
    }
  }
  return null;
};

const fiberOf = (element) => {
  const key = reactKeyOf(element, '__reactFiber$');
  return key === null ? null : element[key];
};

const typeNameOf = (type) => {
  if (type == null) {
    return null;
  }
  if (typeof type === 'function') {
    const name = type.displayName || type.name;
    return typeof name === 'string' && name !== '' ? name : null;
  }
  if (typeof type === 'object') {
    if (typeof type.displayName === 'string' && type.displayName !== '') {
      return type.displayName;
    }
    return typeNameOf(type.render) || typeNameOf(type.type);
  }
  return null;
};

const componentOf = (fiber) => {
  if (fiber == null || fiber._debugOwner == null) {
    return null;
  }
  const name = typeNameOf(fiber._debugOwner.type);
  return name === null ? null : clip(name, MAX_PICK_NAME);
};

const frameOfLine = (raw) => {
  let line = toText(raw).trim();
  if (line.endsWith(')')) {
    line = line.slice(0, -1);
  }
  const column = line.lastIndexOf(':');
  const lineMark = column > 0 ? line.lastIndexOf(':', column - 1) : -1;
  if (lineMark <= 0) {
    return null;
  }
  const lineText = line.slice(lineMark + 1, column);
  const columnText = line.slice(column + 1);
  if (!isDigits(lineText) || !isDigits(columnText)) {
    return null;
  }
  let address = line.slice(0, lineMark);
  const start = Math.max(
    address.lastIndexOf('('),
    address.lastIndexOf('@'),
    address.lastIndexOf(' '),
  );
  address = address.slice(start + 1);
  try {
    const url = new Url(address, here.href);
    if (url.origin !== here.origin) {
      return null;
    }
    const path = url.pathname;
    if (
      path.indexOf('/node_modules/') !== -1 ||
      path.indexOf('/.vite/') !== -1 ||
      path.indexOf('/@') === 0
    ) {
      return null;
    }
    return { url: url.href, path, line: Number(lineText), column: Number(columnText) };
  } catch {
    return null;
  }
};

const frameOf = (fiber) => {
  if (fiber == null || fiber._debugStack == null) {
    return null;
  }
  const stack = fiber._debugStack.stack;
  if (typeof stack !== 'string') {
    return null;
  }
  const lines = stack.split('\n');
  for (let index = 0; index < lines.length; index += 1) {
    const frame = frameOfLine(lines[index]);
    if (frame !== null) {
      return frame;
    }
  }
  return null;
};

const vlqOf = (text, at) => {
  let value = 0;
  let shift = 0;
  let index = at;
  while (index < text.length) {
    const digit = VLQ_DIGITS.indexOf(text.charAt(index));
    index += 1;
    if (digit < 0) {
      return null;
    }
    value += (digit & 31) << shift;
    if ((digit & 32) === 0) {
      return { value: value & 1 ? -(value >> 1) : value >> 1, next: index };
    }
    shift += 5;
  }
  return null;
};

const segmentOf = (text) => {
  const values = [];
  let at = 0;
  while (at < text.length) {
    const read = vlqOf(text, at);
    if (read === null) {
      return null;
    }
    values[values.length] = read.value;
    at = read.next;
  }
  return values;
};

const originalLineOf = (map, line, column) => {
  if (map == null || typeof map.mappings !== 'string') {
    return null;
  }
  const rows = map.mappings.split(';');
  if (line < 1 || line > rows.length) {
    return null;
  }
  let sourceLine = 0;
  let found = null;
  for (let row = 0; row < line; row += 1) {
    let generated = 0;
    const segments = rows[row] === '' ? [] : rows[row].split(',');
    for (let index = 0; index < segments.length; index += 1) {
      const values = segmentOf(segments[index]);
      if (values === null) {
        return null;
      }
      generated += values[0];
      if (values.length >= 4) {
        sourceLine += values[2];
        if (row === line - 1 && generated <= column - 1) {
          found = sourceLine + 1;
        }
      }
    }
  }
  return found;
};

const textOfBase64 = (encoded) => {
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Decoder().decode(bytes);
};

const readText = (address) =>
  originalFetch.call(window, address, { credentials: 'same-origin' }).then((response) => {
    if (response == null || !response.ok) {
      return null;
    }
    return response.text();
  });

const mapOfModule = (address, code) => {
  if (typeof code !== 'string' || code.length > MAX_MAP_CHARS) {
    return null;
  }
  const at = code.lastIndexOf(MAP_MARK);
  if (at < 0) {
    return null;
  }
  const mark = code
    .slice(at + MAP_MARK.length)
    .trim()
    .split('\n')[0]
    .trim();
  const inline = mark.indexOf(BASE64_MAP);
  if (mark.indexOf('data:') === 0 && inline > 0) {
    return JSON.parse(textOfBase64(mark.slice(inline + BASE64_MAP.length)));
  }
  const url = new Url(mark, address);
  if (url.origin !== here.origin) {
    return null;
  }
  return readText(url.href).then((text) =>
    typeof text === 'string' && text.length <= MAX_MAP_CHARS ? JSON.parse(text) : null,
  );
};

const sourceMapOf = (address) => {
  const known = sourceMaps.get(address);
  if (known !== undefined) {
    return known;
  }
  const reading = readText(address)
    .then((code) => mapOfModule(address, code))
    .catch(() => null);
  sourceMaps.set(address, reading);
  return reading;
};

const resolveSource = (fact, frame) => {
  if (frame === null || !isLoopbackPage() || typeof originalFetch !== 'function') {
    fact.isSourceSettled = true;
    return;
  }
  sourceMapOf(frame.url)
    .then((map) => {
      const line = map === null ? null : originalLineOf(map, frame.line, frame.column);
      if (line !== null) {
        fact.source = { path: clip(frame.path, MAX_PATH), line };
      }
    })
    .catch(() => null)
    .then(() => {
      fact.isSourceSettled = true;
    });
};

const classesOf = (element) => {
  const raw = typeof element.className === 'string' ? element.className : '';
  return raw
    .split(' ')
    .filter((name) => name !== '' && /^[A-Za-z_][\w-]*$/.test(name))
    .slice(0, 2);
};

const labelOf = (element) => {
  const tag = element.localName;
  if (typeof element.id === 'string' && element.id !== '') {
    return clip(tag + '#' + element.id, MAX_PICK_NAME);
  }
  const classes = classesOf(element);
  return clip(classes.length > 0 ? tag + '.' + classes.join('.') : tag, MAX_PICK_NAME);
};

const quotedAttr = (value) => '"' + toText(value).replace(/["\\]/g, '\\$&') + '"';

const stepOf = (element) => {
  const testId = element.getAttribute('data-testid');
  if (testId !== null && testId !== '') {
    return { text: '[data-testid=' + quotedAttr(testId) + ']', isAnchor: true };
  }
  const id = element.id;
  if (typeof id === 'string' && /^[A-Za-z][\w-]*$/.test(id)) {
    return { text: '#' + id, isAnchor: true };
  }
  const tag = element.localName;
  const parent = element.parentElement;
  let text = tag;
  const classes = classesOf(element);
  if (classes.length > 0) {
    text += '.' + classes.join('.');
  }
  if (parent !== null) {
    let count = 0;
    let place = 0;
    const siblings = parent.children;
    for (let index = 0; index < siblings.length; index += 1) {
      if (siblings[index].localName === tag) {
        count += 1;
        if (siblings[index] === element) {
          place = count;
        }
      }
    }
    if (count > 1) {
      text += ':nth-of-type(' + place + ')';
    }
  }
  return { text, isAnchor: false };
};

const selectorOf = (element) => {
  const steps = [];
  let node = element;
  while (node !== null && node !== document.documentElement && steps.length < MAX_SELECTOR_DEPTH) {
    const step = stepOf(node);
    steps.unshift(step.text);
    if (step.isAnchor) {
      break;
    }
    node = node.parentElement;
  }
  return clip(steps.join(' > '), MAX_PICK_SELECTOR);
};

const visibleTextOf = (element) => {
  const raw = typeof element.innerText === 'string' ? element.innerText : element.textContent;
  return clip(
    toText(raw == null ? '' : raw)
      .replace(/\s+/g, ' ')
      .trim(),
    MAX_PICK_TEXT,
  );
};

const stylesOf = (element) => {
  const styles = [];
  quietly(() => {
    const computed = window.getComputedStyle(element);
    for (let index = 0; index < PICK_STYLES.length; index += 1) {
      const value = computed.getPropertyValue(PICK_STYLES[index]);
      if (value !== '') {
        styles[styles.length] = { name: PICK_STYLES[index], value: clip(value, MAX_PICK_NAME) };
      }
    }
  });
  return styles;
};

const rectOf = (element) => {
  const box = element.getBoundingClientRect();
  return {
    x: Math.round(box.left * 2) / 2,
    y: Math.round(box.top * 2) / 2,
    width: Math.round(box.width * 2) / 2,
    height: Math.round(box.height * 2) / 2,
  };
};

const factsOf = (element) => {
  const fiber = fiberOf(element);
  const fact = {
    tag: element.localName,
    label: labelOf(element),
    selector: selectorOf(element),
    text: visibleTextOf(element),
    html: clip(toText(element.outerHTML), MAX_PICK_HTML),
    isHtmlCut: toText(element.outerHTML).length > MAX_PICK_HTML,
    styles: stylesOf(element),
    component: componentOf(fiber),
    source: null,
    isSourceSettled: false,
  };
  resolveSource(fact, frameOf(fiber));
  return fact;
};

const nodeOf = (tag, name, text) => {
  const node = document.createElement(tag);
  if (name !== '') {
    node.className = name;
  }
  if (text !== '') {
    node.textContent = text;
  }
  return node;
};

const boxNodeOf = (element, name) => {
  const box = rectOf(element);
  const node = nodeOf('div', name, '');
  node.style.left = box.x + 'px';
  node.style.top = box.y + 'px';
  node.style.width = box.width + 'px';
  node.style.height = box.height + 'px';
  return node;
};

const tagNodeOf = (element) => {
  const box = rectOf(element);
  const component = componentOf(fiberOf(element));
  const node = nodeOf('div', 'tag', component === null ? '' : '<' + component + '> ');
  node.appendChild(
    nodeOf(
      'span',
      '',
      labelOf(element) + ' \u00b7 ' + Math.round(box.width) + '\u00d7' + Math.round(box.height),
    ),
  );
  node.style.left = Math.max(4, box.x) + 'px';
  node.style.top = (box.y > 26 ? box.y - 24 : box.y + box.height + 4) + 'px';
  return node;
};

const hintNode = () => {
  const node = nodeOf('div', 'hint', '');
  node.appendChild(nodeOf('b', '', 'Select an element'));
  node.appendChild(nodeOf('span', '', 'Shift to add more'));
  node.appendChild(nodeOf('span', 'kbd', 'esc'));
  return node;
};

const drawPicker = () => {
  picker.isDrawPending = false;
  if (!picker.isOn || picker.layer === null) {
    return;
  }
  const layer = picker.layer;
  while (layer.firstChild !== null) {
    layer.removeChild(layer.firstChild);
  }
  for (let index = 0; index < picker.held.length; index += 1) {
    layer.appendChild(boxNodeOf(picker.held[index], 'box picked'));
  }
  const hover = picker.hover;
  if (hover !== null && picker.held.indexOf(hover) === -1) {
    layer.appendChild(boxNodeOf(hover, 'box'));
  }
  if (hover !== null) {
    layer.appendChild(tagNodeOf(hover));
  }
  if (picker.held.length === 0) {
    layer.appendChild(hintNode());
  }
};

const drawSoon = () => {
  if (picker.isDrawPending) {
    return;
  }
  picker.isDrawPending = true;
  window.requestAnimationFrame(drawPicker);
};

const elementAt = (x, y) => {
  const found = document.elementsFromPoint(x, y);
  for (let index = 0; index < found.length; index += 1) {
    const element = found[index];
    if (element !== picker.host && element !== document.documentElement) {
      return element;
    }
  }
  return null;
};

const mountPicker = () => {
  const host = document.createElement(PICK_HOST_TAG);
  host.setAttribute('style', HOST_STYLE);
  const root = host.attachShadow({ mode: 'closed' });
  root.appendChild(nodeOf('style', '', SHADOW_STYLE));
  const layer = nodeOf('div', '', '');
  root.appendChild(layer);
  document.documentElement.appendChild(host);
  picker.host = host;
  picker.layer = layer;
};

const unmountPicker = () => {
  if (picker.host !== null && picker.host.parentNode !== null) {
    picker.host.parentNode.removeChild(picker.host);
  }
  picker.host = null;
  picker.layer = null;
};

const startPick = () => {
  if (picker.isOn || document.documentElement == null) {
    return;
  }
  picker.isOn = true;
  picker.isLeft = false;
  picker.held = [];
  picker.facts = [];
  picker.hover = null;
  picker.round += 1;
  mountPicker();
  drawSoon();
};

const stopPick = (isLeft) => {
  if (!picker.isOn) {
    return;
  }
  picker.isOn = false;
  picker.isLeft = isLeft;
  picker.hover = null;
  picker.round += 1;
  unmountPicker();
};

const choose = (element, isAdding) => {
  const at = picker.held.indexOf(element);
  if (!isAdding) {
    picker.held = [element];
    picker.facts = [factsOf(element)];
  } else if (at !== -1) {
    picker.held = picker.held.filter((_, index) => index !== at);
    picker.facts = picker.facts.filter((_, index) => index !== at);
  } else if (picker.held.length < MAX_PICKS) {
    picker.held = picker.held.concat([element]);
    picker.facts = picker.facts.concat([factsOf(element)]);
  }
  picker.round += 1;
  drawSoon();
};

const isPickerEvent = (event) => picker.isOn && event.target === picker.host;

const swallow = (event) => {
  event.preventDefault();
  event.stopImmediatePropagation();
};

for (let index = 0; index < PICK_BLOCKED.length; index += 1) {
  window.addEventListener(
    PICK_BLOCKED[index],
    (event) => {
      if (isPickerEvent(event)) {
        swallow(event);
      }
    },
    true,
  );
}

window.addEventListener(
  'pointermove',
  (event) => {
    if (!isPickerEvent(event)) {
      return;
    }
    event.stopImmediatePropagation();
    const element = elementAt(event.clientX, event.clientY);
    if (element !== picker.hover) {
      picker.hover = element;
      drawSoon();
    }
  },
  true,
);

window.addEventListener(
  'click',
  (event) => {
    if (!isPickerEvent(event)) {
      return;
    }
    swallow(event);
    const element = elementAt(event.clientX, event.clientY);
    if (element !== null) {
      choose(element, event.shiftKey === true);
    }
  },
  true,
);

window.addEventListener(
  'keydown',
  (event) => {
    if (!picker.isOn || event.key !== 'Escape') {
      return;
    }
    swallow(event);
    stopPick(true);
  },
  true,
);

window.addEventListener(
  'scroll',
  () => {
    if (picker.isOn) {
      drawSoon();
    }
  },
  true,
);

window.addEventListener('resize', () => {
  if (picker.isOn) {
    drawSoon();
  }
});

const pickAnswer = () => {
  const picks = [];
  for (let index = 0; index < picker.facts.length; index += 1) {
    const element = picker.held[index];
    const fact = picker.facts[index];
    picks[picks.length] = {
      tag: fact.tag,
      label: fact.label,
      selector: fact.selector,
      text: fact.text,
      html: fact.html,
      isHtmlCut: fact.isHtmlCut,
      styles: fact.styles,
      component: fact.component,
      source: fact.source,
      isSourceSettled: fact.isSourceSettled,
      rect: element.isConnected ? rectOf(element) : null,
      url: here.href,
    };
  }
  return stringify({
    doc,
    isOn: picker.isOn,
    isLeft: picker.isLeft,
    round: picker.round,
    scale: window.devicePixelRatio || 1,
    picks,
  });
};

window.addEventListener(
  PICK_EVENT,
  (event) => {
    const box = event.detail;
    if (box == null || typeof box !== 'object') {
      return;
    }
    quietly(() => event.stopImmediatePropagation());
    quietly(() => {
      if (box.op === 'start') {
        startPick();
      }
      if (box.op === 'stop') {
        stopPick(false);
      }
    });
    box.answer = pickAnswer();
  },
  true,
);
