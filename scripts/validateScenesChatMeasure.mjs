export const CHAT_MEASURE_SCENE = 'chat-room';
export const CHAT_MEASURE_WIDTHS = [1100, 1440, 2000];
export const CHAT_MEASURE_TOLERANCE_PX = 1;
export const CHAT_MEASURE_READY = 'ol[aria-label="Messages"]';

export const chatMeasureProbe = () => {
  const contentEdges = ({ element }) => {
    if (element === null) {
      return null;
    }
    const box = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return {
      left: box.left + parseFloat(style.paddingLeft),
      right: box.right - parseFloat(style.paddingRight),
    };
  };
  const boxEdges = ({ element }) => {
    if (element === null) {
      return null;
    }
    const box = element.getBoundingClientRect();
    return { left: box.left, right: box.right };
  };
  const messages = document.querySelector('ol[aria-label="Messages"]');
  const room = messages === null ? null : messages.closest('section');
  if (room === null) {
    return null;
  }
  const composer = room.querySelector('textarea');
  return {
    header: contentEdges({ element: room.querySelector('header [data-page-column]') }),
    title: boxEdges({ element: room.querySelector('header h1') }),
    remove: boxEdges({ element: room.querySelector('header button[aria-label="Delete chat"]') }),
    messages: boxEdges({ element: messages }),
    copy: boxEdges({ element: room.querySelector('button[aria-label="Copy the answer"]') }),
    composer: contentEdges({
      element: composer === null ? null : composer.closest('[data-page-column]'),
    }),
  };
};

const round = ({ value }) => Math.round(value * 10) / 10;

const spreadFailure = ({ scene, width, check, edges, tolerance }) => {
  const values = Object.values(edges);
  const spread = Math.max(...values) - Math.min(...values);
  if (spread <= tolerance) {
    return [];
  }
  return [
    {
      scene,
      width,
      check,
      spread: round({ value: spread }),
      edges: Object.fromEntries(
        Object.entries(edges).map(([name, value]) => [name, round({ value })]),
      ),
    },
  ];
};

export const chatMeasureFailures = ({
  scene,
  width,
  probe,
  tolerance = CHAT_MEASURE_TOLERANCE_PX,
}) => {
  if (probe === null) {
    return [{ scene, width, check: 'no chat room to measure' }];
  }
  const missing = Object.entries(probe)
    .filter(([, edges]) => edges === null)
    .map(([name]) => name);
  if (missing.length > 0) {
    return [{ scene, width, check: `chat room is missing ${missing.join(', ')}` }];
  }
  return [
    ...spreadFailure({
      scene,
      width,
      check: 'chat header, thread and composer start on different left edges',
      edges: {
        header: probe.header.left,
        title: probe.title.left,
        messages: probe.messages.left,
        composer: probe.composer.left,
      },
      tolerance,
    }),
    ...spreadFailure({
      scene,
      width,
      check: 'chat header, thread and composer end on different right edges',
      edges: {
        header: probe.header.right,
        remove: probe.remove.right,
        messages: probe.messages.right,
        copy: probe.copy.right,
        composer: probe.composer.right,
      },
      tolerance,
    }),
  ];
};
