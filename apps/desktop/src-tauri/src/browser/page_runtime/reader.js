const ANSWER_BUDGET = 1000000;

const freshAfter = (after) => {
  const fresh = [];
  for (let kind = 0; kind < KINDS.length; kind += 1) {
    const ring = rings[KINDS[kind]];
    for (let index = 0; index < ring.length; index += 1) {
      if (ring[index].seq > after) {
        fresh[fresh.length] = ring[index];
      }
    }
  }
  return fresh.sort((left, right) => left.seq - right.seq);
};

const answerAfter = (after) => {
  const fresh = freshAfter(after);
  const parts = [];
  let size = 0;
  for (let index = 0; index < fresh.length; index += 1) {
    const part = stringify(fresh[index]);
    if (parts.length > 0 && size + part.length > ANSWER_BUDGET) {
      break;
    }
    parts[parts.length] = part;
    size += part.length + 1;
  }
  return '{"doc":' + stringify(doc) + ',"entries":[' + parts.join(',') + ']}';
};

window.addEventListener(
  READ_EVENT,
  (event) => {
    const box = event.detail;
    if (box == null || typeof box !== 'object') {
      return;
    }
    quietly(() => event.stopImmediatePropagation());
    box.answer = answerAfter(box.doc === doc && typeof box.after === 'number' ? box.after : 0);
  },
  true,
);
