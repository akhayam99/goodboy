(() => {
  if (window.top !== window) {
    return;
  }
  const READ_EVENT = '__GOODBOY_CONSOLE_READ__';
  const RING_SIZE = 500;
  const MAX_TEXT = 2000;
  const MAX_SOURCE = 200;
  const MAX_PATH = 500;
  const MAX_METHOD = 16;
  const MAX_DEPTH = 2;
  const MAX_KEYS = 20;
  const MAX_STACK_LINE = 500;
  const HOOK_FRAME = 'goodboyConsoleHook';
  const LEVELS = [
    ['log', 'log'],
    ['info', 'info'],
    ['debug', 'log'],
    ['warn', 'warn'],
    ['error', 'error'],
  ];
  const stringify = JSON.stringify;
  const toText = String;
  const tagOf = Object.prototype.toString;
  const Url = window.URL;
  const here = window.location;
  const ring = [];
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

  const sourceOfStack = (stack, marker) => {
    if (typeof stack !== 'string') {
      return null;
    }
    const lines = stack.split('\n');
    let first = 0;
    if (marker !== null) {
      for (let index = 0; index < lines.length; index += 1) {
        if (lines[index].indexOf(marker) >= 0) {
          first = index + 1;
        }
      }
    }
    for (let index = first; index < lines.length; index += 1) {
      const source = sourceOfLine(lines[index]);
      if (source !== null) {
        return source;
      }
    }
    return null;
  };

  const store = (entry) => {
    seq += 1;
    entry.seq = seq;
    ring[ring.length] = entry;
    if (ring.length > RING_SIZE) {
      ring.splice(0, ring.length - RING_SIZE);
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

  const recordConsole = (level, textOf, sourceOf) =>
    guarded(() =>
      store({
        kind: 'console',
        level,
        text: clip(textOf(), MAX_TEXT),
        source: sourceOf(),
        method: null,
        status: null,
      }),
    );

  const pathOf = (address) => {
    try {
      const url = new Url(toText(address), here.href);
      if (url.protocol === 'data:' || url.protocol === 'blob:') {
        return url.protocol;
      }
      const path = clip(url.pathname, MAX_PATH);
      return url.origin === here.origin ? path : clip(url.host + path, MAX_PATH);
    } catch {
      return '';
    }
  };

  const recordNetwork = (method, status, address) =>
    guarded(() =>
      store({
        kind: 'network',
        level: 'error',
        text: pathOf(address),
        source: null,
        method: clip(toText(method).toUpperCase(), MAX_METHOD),
        status,
      }),
    );

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

  const cons = window.console;
  if (cons != null) {
    for (let index = 0; index < LEVELS.length; index += 1) {
      const name = LEVELS[index][0];
      const level = LEVELS[index][1];
      const original = cons[name];
      if (typeof original !== 'function') {
        continue;
      }
      cons[name] = function goodboyConsoleHook() {
        if (!isBusy) {
          const args = arguments;
          let stack = null;
          try {
            stack = new Error().stack;
          } catch {
            stack = null;
          }
          recordConsole(
            level,
            () => textOfArgs(args),
            () => sourceOfStack(stack, HOOK_FRAME),
          );
        }
        return original.apply(this, arguments);
      };
    }
  }

  const addressOfElement = (element) => {
    const candidates = [element.currentSrc, element.src, element.href];
    for (let index = 0; index < candidates.length; index += 1) {
      if (typeof candidates[index] === 'string' && candidates[index] !== '') {
        return candidates[index];
      }
    }
    return '';
  };

  window.addEventListener(
    'error',
    (event) => {
      const target = event.target;
      if (target != null && target !== window && typeof target.nodeName === 'string') {
        recordNetwork('GET', 0, addressOfElement(target));
        return;
      }
      recordConsole(
        'error',
        () =>
          typeof event.message === 'string' && event.message !== ''
            ? event.message
            : describe(event.error, 0),
        () =>
          typeof event.filename === 'string' && event.filename !== ''
            ? clip(fileOf(event.filename) + ':' + toText(event.lineno), MAX_SOURCE)
            : null,
      );
    },
    true,
  );

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    recordConsole(
      'error',
      () => 'Unhandled rejection: ' + describe(reason, 0),
      () =>
        reason != null && tagOf.call(reason) === '[object Error]'
          ? sourceOfStack(reason.stack, null)
          : null,
    );
  });

  const methodOf = (input, init) => {
    if (init != null && typeof init.method === 'string') {
      return init.method;
    }
    if (input != null && typeof input.method === 'string') {
      return input.method;
    }
    return 'GET';
  };

  const addressOfInput = (input) => {
    if (typeof input === 'string') {
      return input;
    }
    if (input != null && typeof input.url === 'string') {
      return input.url;
    }
    return toText(input);
  };

  const originalFetch = window.fetch;
  if (typeof originalFetch === 'function') {
    window.fetch = function (input, init) {
      const answer = originalFetch.apply(this, arguments);
      quietly(() => {
        const method = methodOf(input, init);
        const address = addressOfInput(input);
        answer.then(
          (response) => {
            if (response != null && response.status >= 400) {
              recordNetwork(method, response.status, address);
            }
          },
          () => recordNetwork(method, 0, address),
        );
      });
      return answer;
    };
  }

  const Request = window.XMLHttpRequest;
  if (typeof Request === 'function' && Request.prototype != null) {
    const proto = Request.prototype;
    const open = proto.open;
    const send = proto.send;
    const requests = new WeakMap();
    if (typeof open === 'function' && typeof send === 'function') {
      proto.open = function (method, address) {
        const xhr = this;
        quietly(() => requests.set(xhr, { method: toText(method), address: toText(address) }));
        return open.apply(this, arguments);
      };
      proto.send = function () {
        const xhr = this;
        const request = requests.get(xhr);
        if (request !== undefined) {
          requests.delete(xhr);
          quietly(() => {
            xhr.addEventListener('load', () => {
              if (xhr.status >= 400) {
                recordNetwork(request.method, xhr.status, request.address);
              }
            });
            xhr.addEventListener('error', () => recordNetwork(request.method, 0, request.address));
            xhr.addEventListener('timeout', () =>
              recordNetwork(request.method, 0, request.address),
            );
          });
        }
        return send.apply(this, arguments);
      };
    }
  }

  window.addEventListener(
    READ_EVENT,
    (event) => {
      const box = event.detail;
      if (box == null || typeof box !== 'object') {
        return;
      }
      quietly(() => event.stopImmediatePropagation());
      const after = box.doc === doc && typeof box.after === 'number' ? box.after : 0;
      const entries = [];
      for (let index = 0; index < ring.length; index += 1) {
        if (ring[index].seq > after) {
          entries[entries.length] = ring[index];
        }
      }
      box.answer = stringify({ doc, entries });
    },
    true,
  );
})();
