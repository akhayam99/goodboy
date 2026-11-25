const MAX_BODY = 65536;
const MAX_HEADERS = 50;
const MAX_HEADER_NAME = 100;
const MAX_HEADER_VALUE = 1000;
const BODY_BUDGET = 2000000;
const SENSITIVE_HEADERS = [
  'authorization',
  'proxy-authorization',
  'cookie',
  'set-cookie',
  'set-cookie2',
  'x-api-key',
  'x-auth-token',
  'x-csrf-token',
  'x-xsrf-token',
];
const SCRIPT_ENDINGS = ['.js', '.mjs', '.cjs', '.jsx', '.ts', '.tsx'];
const IMAGE_ENDINGS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.svg', '.ico', '.bmp'];
const ELEMENT_TYPES = { IMG: 'img', SCRIPT: 'script', LINK: 'style', IFRAME: 'doc' };
const Decoder = window.TextDecoder;
const reflect = Reflect;
const protoOf = Object.setPrototypeOf;
let requestCount = 0;

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

const endsWithAny = (text, endings) => {
  for (let index = 0; index < endings.length; index += 1) {
    if (text.endsWith(endings[index])) {
      return true;
    }
  }
  return false;
};

const typeOfPath = (address) => {
  const file = fileOf(address).toLowerCase();
  if (file.endsWith('.css')) {
    return 'style';
  }
  if (endsWithAny(file, SCRIPT_ENDINGS)) {
    return 'script';
  }
  return endsWithAny(file, IMAGE_ENDINGS) ? 'img' : 'other';
};

const typeOfTiming = (item) => {
  const initiator = toText(item.initiatorType);
  if (initiator === 'navigation' || initiator === 'iframe' || initiator === 'frame') {
    return 'doc';
  }
  if (initiator === 'img' || initiator === 'image') {
    return 'img';
  }
  if (initiator === 'script') {
    return 'script';
  }
  return typeOfPath(item.name);
};

const typeOfElement = (element) => {
  const name = toText(element.nodeName).toUpperCase();
  return Object.prototype.hasOwnProperty.call(ELEMENT_TYPES, name) ? ELEMENT_TYPES[name] : 'other';
};

const isSensitive = (name) => SENSITIVE_HEADERS.indexOf(name) !== -1;

const addHeader = (list, name, value) => {
  const key = clip(toText(name).trim().toLowerCase(), MAX_HEADER_NAME);
  if (list.length >= MAX_HEADERS || key === '' || isSensitive(key)) {
    return;
  }
  list[list.length] = { name: key, value: clip(toText(value), MAX_HEADER_VALUE) };
};

const headersOf = (source) => {
  const list = [];
  quietly(() => {
    if (source == null || typeof source !== 'object') {
      return;
    }
    if (Array.isArray(source)) {
      for (let index = 0; index < source.length; index += 1) {
        const pair = source[index];
        if (pair != null && pair.length === 2) {
          addHeader(list, pair[0], pair[1]);
        }
      }
      return;
    }
    if (typeof source.forEach === 'function') {
      source.forEach((value, name) => addHeader(list, name, value));
      return;
    }
    const keys = Object.keys(source);
    for (let index = 0; index < keys.length; index += 1) {
      addHeader(list, keys[index], source[keys[index]]);
    }
  });
  return list;
};

const headersOfText = (text) => {
  const list = [];
  if (typeof text !== 'string') {
    return list;
  }
  const lines = text.split('\n');
  for (let index = 0; index < lines.length; index += 1) {
    const at = lines[index].indexOf(':');
    if (at > 0) {
      addHeader(list, lines[index].slice(0, at), lines[index].slice(at + 1).trim());
    }
  }
  return list;
};

const headerValueOf = (list, name) => {
  for (let index = 0; index < list.length; index += 1) {
    if (list[index].name === name) {
      return list[index].value;
    }
  }
  return '';
};

const declaredSizeOf = (list) => {
  const value = headerValueOf(list, 'content-length').trim();
  return isDigits(value) ? Number(value) : null;
};

const isTextType = (type) => {
  const value = type.toLowerCase();
  if (value.indexOf('text/event-stream') === 0) {
    return false;
  }
  return (
    value.indexOf('text/') === 0 ||
    value.indexOf('json') !== -1 ||
    value.indexOf('xml') !== -1 ||
    value.indexOf('javascript') !== -1 ||
    value.indexOf('x-www-form-urlencoded') !== -1
  );
};

const requestBodyOf = (body, type) => {
  if (typeof body === 'string') {
    return type === '' || isTextType(type) ? clip(body, MAX_BODY) : null;
  }
  if (body != null && tagOf.call(body) === '[object URLSearchParams]') {
    return clip(toText(body), MAX_BODY);
  }
  return null;
};

const methodText = (method) => clip(toText(method).toUpperCase(), MAX_METHOD);

const openRequest = (type, method, address) => {
  requestCount += 1;
  return {
    id: 'r' + toText(requestCount),
    type,
    method: methodText(method),
    address: toText(address),
    start: now(),
    requestHeaders: [],
    requestBody: null,
    hasFailed: false,
  };
};

const answerOf = (end, size, responseHeaders, responseBody, socket) => ({
  end,
  size,
  responseHeaders,
  responseBody,
  socket,
});

const bodyLengthOf = (request) =>
  (request.requestBody === null ? 0 : request.requestBody.length) +
  (request.responseBody === null ? 0 : request.responseBody.length);

const keepBodiesInBudget = () => {
  const ring = rings.network;
  let total = 0;
  for (let index = ring.length - 1; index >= 0; index -= 1) {
    const request = ring[index].network;
    const size = bodyLengthOf(request);
    if (total + size > BODY_BUDGET) {
      request.requestBody = null;
      request.responseBody = null;
      continue;
    }
    total += size;
  }
};

const storeRequest = (entry) => {
  const ring = rings.network;
  for (let index = 0; index < ring.length; index += 1) {
    if (ring[index].network.id === entry.network.id) {
      seq += 1;
      entry.seq = seq;
      ring[index] = entry;
      keepBodiesInBudget();
      return;
    }
  }
  store(entry);
  keepBodiesInBudget();
};

const isFailed = (status) => status !== null && (status === 0 || status >= 400);

const saveRequest = (request, status, answer) =>
  guarded(() => {
    const path = pathOf(request.address);
    storeRequest({
      kind: 'network',
      level: isFailed(status) ? 'error' : 'info',
      text: path,
      source: null,
      method: request.method,
      status,
      network: {
        id: request.id,
        type: request.type,
        start: request.start,
        duration:
          answer.end === null
            ? null
            : Math.max(0, Math.round((answer.end - request.start) * 10) / 10),
        size: answer.size,
        requestHeaders: request.requestHeaders,
        responseHeaders: answer.responseHeaders,
        requestBody: request.requestBody,
        responseBody: answer.responseBody,
        socket: answer.socket,
      },
      error: null,
    });
    if (!isFailed(status) || request.hasFailed) {
      return;
    }
    request.hasFailed = true;
    storeError(
      'request',
      request.method + ' ' + path + ' ' + (status === 0 ? 'failed' : toText(status)),
      null,
      null,
      request.id,
    );
  });

const statusOf = (value) => (typeof value === 'number' && value >= 0 ? value : 0);

const readCapped = (response, done) =>
  quietly(() => {
    if (typeof Decoder !== 'function' || typeof response.clone !== 'function') {
      return;
    }
    const body = response.clone().body;
    if (body == null || typeof body.getReader !== 'function') {
      return;
    }
    const reader = body.getReader();
    const decoder = new Decoder();
    let text = '';
    let bytes = 0;
    const step = () =>
      reader.read().then(
        (part) => {
          if (part.done) {
            done(clip(text + decoder.decode(), MAX_BODY), bytes);
            return undefined;
          }
          bytes += part.value.byteLength;
          text += decoder.decode(part.value, { stream: true });
          if (text.length >= MAX_BODY) {
            quietly(() => reader.cancel());
            done(clip(text, MAX_BODY), null);
            return undefined;
          }
          return step();
        },
        () => undefined,
      );
    step();
  });

const answerFetch = (request, response) => {
  const status = statusOf(response.status);
  const responseHeaders = headersOf(response.headers);
  const declared = declaredSizeOf(responseHeaders);
  saveRequest(request, status, answerOf(now(), declared, responseHeaders, null, null));
  if (!isTextType(headerValueOf(responseHeaders, 'content-type'))) {
    return;
  }
  readCapped(response, (body, bytes) =>
    saveRequest(
      request,
      status,
      answerOf(now(), bytes === null ? declared : bytes, responseHeaders, body, null),
    ),
  );
};

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

const fetchRequestOf = (input, init) => {
  const request = openRequest('fetch', methodOf(input, init), addressOfInput(input));
  quietly(() => {
    const hasInit = init != null && init.headers != null;
    request.requestHeaders = headersOf(
      hasInit ? init.headers : input != null ? input.headers : null,
    );
    request.requestBody = requestBodyOf(
      init != null ? init.body : null,
      headerValueOf(request.requestHeaders, 'content-type'),
    );
  });
  return request;
};

const originalFetch = window.fetch;
if (typeof originalFetch === 'function') {
  window.fetch = function (input, init) {
    let request = null;
    quietly(() => {
      request = fetchRequestOf(input, init);
    });
    const answer = originalFetch.apply(this, arguments);
    return answer.then(
      (response) => {
        quietly(() => {
          if (request !== null && response != null) {
            answerFetch(request, response);
          }
        });
        return response;
      },
      (reason) => {
        if (request !== null) {
          saveRequest(request, 0, answerOf(now(), null, [], null, null));
        }
        throw reason;
      },
    );
  };
}

const xhrBodyOf = (xhr, type) => {
  let body = null;
  quietly(() => {
    if (!isTextType(type)) {
      return;
    }
    const kind = xhr.responseType;
    if ((kind === '' || kind === 'text') && typeof xhr.responseText === 'string') {
      body = clip(xhr.responseText, MAX_BODY);
      return;
    }
    if (kind === 'json' && xhr.response != null) {
      body = clip(stringify(xhr.response), MAX_BODY);
    }
  });
  return body;
};

const xhrAnswerOf = (xhr) => {
  let responseHeaders = [];
  quietly(() => {
    if (typeof xhr.getAllResponseHeaders === 'function') {
      responseHeaders = headersOfText(xhr.getAllResponseHeaders());
    }
  });
  const body = xhrBodyOf(xhr, headerValueOf(responseHeaders, 'content-type'));
  return answerOf(now(), declaredSizeOf(responseHeaders), responseHeaders, body, null);
};

const Request = window.XMLHttpRequest;
if (typeof Request === 'function' && Request.prototype != null) {
  const proto = Request.prototype;
  const open = proto.open;
  const send = proto.send;
  const setHeader = proto.setRequestHeader;
  const requests = new WeakMap();
  if (typeof open === 'function' && typeof send === 'function') {
    proto.open = function (method, address) {
      const xhr = this;
      quietly(() => requests.set(xhr, openRequest('xhr', method, address)));
      return open.apply(this, arguments);
    };
    if (typeof setHeader === 'function') {
      proto.setRequestHeader = function (name, value) {
        const xhr = this;
        quietly(() => {
          const request = requests.get(xhr);
          if (request !== undefined) {
            addHeader(request.requestHeaders, name, value);
          }
        });
        return setHeader.apply(this, arguments);
      };
    }
    proto.send = function (body) {
      const xhr = this;
      const request = requests.get(xhr);
      if (request !== undefined) {
        requests.delete(xhr);
        quietly(() => {
          request.start = now();
          request.requestBody = requestBodyOf(
            body,
            headerValueOf(request.requestHeaders, 'content-type'),
          );
          xhr.addEventListener('load', () =>
            saveRequest(request, statusOf(xhr.status), xhrAnswerOf(xhr)),
          );
          xhr.addEventListener('error', () =>
            saveRequest(request, 0, answerOf(now(), null, [], null, null)),
          );
          xhr.addEventListener('timeout', () =>
            saveRequest(request, 0, answerOf(now(), null, [], null, null)),
          );
        });
      }
      return send.apply(this, arguments);
    };
  }
}

const socketAnswerOf = (counts, phase, code) =>
  answerOf(phase === 'closed' ? now() : null, null, [], null, {
    phase,
    sent: counts.sent,
    received: counts.received,
    code,
  });

const wrapConstructor = (Native, watch) => {
  const Wrapped = function () {
    if (new.target === undefined) {
      return Native.apply(this, arguments);
    }
    const made = reflect.construct(Native, arguments, new.target);
    quietly(() => watch(made, arguments[0]));
    return made;
  };
  Wrapped.prototype = Native.prototype;
  protoOf(Wrapped, Native);
  return Wrapped;
};

const NativeSocket = window.WebSocket;
if (typeof NativeSocket === 'function' && NativeSocket.prototype != null) {
  const counted = new WeakMap();
  const sendFrame = NativeSocket.prototype.send;
  const watchSocket = (socket, address) => {
    const request = openRequest('ws', 'GET', address);
    const counts = { sent: 0, received: 0 };
    let isOpen = false;
    counted.set(socket, counts);
    socket.addEventListener('open', () => {
      isOpen = true;
      saveRequest(request, 101, socketAnswerOf(counts, 'open', null));
    });
    socket.addEventListener('message', () => {
      counts.received += 1;
    });
    socket.addEventListener('close', (event) =>
      saveRequest(
        request,
        isOpen ? 101 : 0,
        socketAnswerOf(counts, 'closed', typeof event.code === 'number' ? event.code : null),
      ),
    );
  };
  if (typeof sendFrame === 'function') {
    NativeSocket.prototype.send = function () {
      const counts = counted.get(this);
      if (counts !== undefined) {
        counts.sent += 1;
      }
      return sendFrame.apply(this, arguments);
    };
  }
  window.WebSocket = wrapConstructor(NativeSocket, watchSocket);
}

const NativeSource = window.EventSource;
if (typeof NativeSource === 'function' && NativeSource.prototype != null) {
  const watched = new WeakMap();
  const closeSource = NativeSource.prototype.close;
  const watchSource = (source, address) => {
    const request = openRequest('sse', 'GET', address);
    const counts = { sent: 0, received: 0 };
    let isOpen = false;
    let isClosed = false;
    const end = () => {
      if (isClosed) {
        return;
      }
      isClosed = true;
      saveRequest(request, isOpen ? 200 : 0, socketAnswerOf(counts, 'closed', null));
    };
    watched.set(source, end);
    source.addEventListener('open', () => {
      if (isOpen) {
        return;
      }
      isOpen = true;
      saveRequest(request, 200, socketAnswerOf(counts, 'open', null));
    });
    source.addEventListener('message', () => {
      counts.received += 1;
    });
    source.addEventListener('error', () => {
      if (source.readyState === 2) {
        end();
      }
    });
  };
  if (typeof closeSource === 'function') {
    NativeSource.prototype.close = function () {
      const answer = closeSource.apply(this, arguments);
      const end = watched.get(this);
      if (end !== undefined) {
        quietly(end);
      }
      return answer;
    };
  }
  window.EventSource = wrapConstructor(NativeSource, watchSource);
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
    if (!isElement(target)) {
      return;
    }
    quietly(() =>
      saveRequest(
        openRequest(typeOfElement(target), 'GET', addressOfElement(target)),
        0,
        answerOf(null, null, [], null, null),
      ),
    );
  },
  true,
);

const timingStatusOf = (item) =>
  typeof item.responseStatus === 'number' && item.responseStatus > 0 ? item.responseStatus : null;

const timingSizeOf = (item) => {
  if (typeof item.encodedBodySize === 'number' && item.encodedBodySize > 0) {
    return item.encodedBodySize;
  }
  return typeof item.transferSize === 'number' && item.transferSize > 0 ? item.transferSize : null;
};

const saveTiming = (item) => {
  const kind = item.initiatorType;
  if (kind === 'fetch' || kind === 'xmlhttprequest' || kind === 'beacon') {
    return;
  }
  const request = openRequest(typeOfTiming(item), 'GET', item.name);
  const start = typeof item.startTime === 'number' ? Math.round(item.startTime * 10) / 10 : 0;
  const duration = typeof item.duration === 'number' ? item.duration : 0;
  request.start = start;
  saveRequest(
    request,
    timingStatusOf(item),
    answerOf(start + duration, timingSizeOf(item), [], null, null),
  );
};

const Observer = window.PerformanceObserver;
if (typeof Observer === 'function') {
  const watchTimings = (type) =>
    quietly(() => {
      const watch = new Observer((list) => {
        const found = list.getEntries();
        for (let index = 0; index < found.length; index += 1) {
          saveTiming(found[index]);
        }
      });
      watch.observe({ type, buffered: true });
    });
  watchTimings('navigation');
  watchTimings('resource');
}
