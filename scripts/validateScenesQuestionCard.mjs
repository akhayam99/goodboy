export const QUESTION_CARD_SCENES = ['u34-question-card-states'];
export const QUESTION_CARD_WIDTHS = [360, 960, 1440];
export const QUESTION_CARD_READY = '[data-qc-case] [data-question-header]';
export const QUESTION_CARD_BASELINE_PX = 1;
export const QUESTION_CARD_PAGER_PX = 1;
export const QUESTION_CARD_EMPTY_PX = 4;
export const QUESTION_CARD_DOT_PX = 1;
export const QUESTION_CARD_EDGE_PX = 1;

export const questionCardProbe = () => {
  const baselineOf = (element) => {
    const marker = document.createElement('span');
    marker.style.cssText =
      'display:inline-block;width:0;height:0;vertical-align:baseline;padding:0;margin:0;border:0';
    element.insertBefore(marker, element.firstChild);
    const baseline = marker.getBoundingClientRect().bottom;
    marker.remove();
    return baseline;
  };
  const isEmptyBox = (element) =>
    element.textContent.trim() === '' &&
    element.querySelector('svg, img, button, input, textarea, [role]') === null;

  return [...document.querySelectorAll('[data-qc-case]')].map((wrapper) => {
    const card = wrapper.querySelector('article');
    const cardRect = card.getBoundingClientRect();
    const title = card.querySelector('[data-question-header]');
    const mark = card.querySelector('[data-question-blocking]');
    const label = card.querySelector('[data-question-blocking-label]');
    const dot = mark === null ? null : mark.firstElementChild;
    const controls = card.querySelector('[data-question-controls]');
    const count =
      controls === null
        ? null
        : ([...controls.querySelectorAll('span')].find(
            (element) => element.children.length === 0 && / of /.test(element.textContent),
          ) ?? null);
    const titleRect = title.getBoundingClientRect();
    const centreOf = (element) => {
      const rect = element.getBoundingClientRect();
      return rect.top + rect.height / 2;
    };
    const dotRect = dot === null ? null : dot.getBoundingClientRect();
    const emptyBoxes = [...card.querySelectorAll('*')]
      .filter(
        (element) =>
          !element.contains(title) &&
          !title.contains(element) &&
          isEmptyBox(element) &&
          element.getBoundingClientRect().height > 4 &&
          element.getBoundingClientRect().width > cardRect.width / 2 &&
          element.getBoundingClientRect().bottom <= titleRect.top + 0.5,
      )
      .map((element) => ({
        tag: element.tagName.toLowerCase(),
        height: Math.round(element.getBoundingClientRect().height * 10) / 10,
      }));
    const firstEdge = titleRect.left;
    const contentLeft =
      cardRect.left +
      parseFloat(getComputedStyle(card).borderLeftWidth) +
      parseFloat(getComputedStyle(card).paddingLeft);
    const overflow = [...card.querySelectorAll('*')].filter(
      (element) => element.getBoundingClientRect().right > cardRect.right + 0.5,
    ).length;
    return {
      name: wrapper.dataset.qcCase,
      hasControls: controls !== null,
      titleLines: Math.round(titleRect.height / parseFloat(getComputedStyle(title).lineHeight)),
      baselineDelta:
        label === null || count === null ? null : Math.abs(baselineOf(label) - baselineOf(count)),
      pagerDelta:
        mark === null || controls === null ? null : Math.abs(centreOf(mark) - centreOf(controls)),
      dotDelta:
        dotRect === null ? null : Math.abs(dotRect.top + dotRect.height / 2 - centreOf(label)),
      edgeDelta: Math.abs(firstEdge - contentLeft),
      emptyBoxes,
      overflow,
    };
  });
};

const round = (value) => Math.round(value * 10) / 10;

export const questionCardFailures = ({ scene, width, measured }) => {
  const failures = [];
  if (measured.length === 0) {
    return [{ scene, width, check: 'the scene shows question cards' }];
  }
  for (const card of measured) {
    const at = { scene, width, card: card.name };
    if (card.baselineDelta !== null && card.baselineDelta > QUESTION_CARD_BASELINE_PX) {
      failures.push({
        ...at,
        check: 'Blocking and the pager count share a baseline',
        delta: round(card.baselineDelta),
      });
    }
    if (card.pagerDelta !== null && card.pagerDelta > QUESTION_CARD_PAGER_PX) {
      failures.push({
        ...at,
        check: 'Blocking and the pager share one centre line',
        delta: round(card.pagerDelta),
      });
    }
    if (card.dotDelta !== null && card.dotDelta > QUESTION_CARD_DOT_PX) {
      failures.push({
        ...at,
        check: 'the dot is centred on Blocking',
        delta: round(card.dotDelta),
      });
    }
    if (card.edgeDelta > QUESTION_CARD_EDGE_PX) {
      failures.push({
        ...at,
        check: 'the question starts on the card edge',
        delta: round(card.edgeDelta),
      });
    }
    if (card.emptyBoxes.length > 0) {
      failures.push({ ...at, check: 'no empty box above the question', boxes: card.emptyBoxes });
    }
    if (card.overflow > 0) {
      failures.push({ ...at, check: 'nothing leaves the card on the right', count: card.overflow });
    }
  }
  return failures;
};

export const runQuestionCard = async ({ send, only, measure, open, run }) => {
  for (const scene of only === undefined || only === 'question-card' ? QUESTION_CARD_SCENES : []) {
    await measure({
      scene,
      task: async () => {
        const failures = [];
        for (const width of QUESTION_CARD_WIDTHS) {
          await open({ send, scene, width, zoom: 1, readySelector: QUESTION_CARD_READY });
          const measured = await run(send, questionCardProbe, null);
          if (process.argv.includes('--verbose')) {
            console.log(JSON.stringify({ scene, width, measured }));
          }
          failures.push(...questionCardFailures({ scene, width, measured }));
        }
        console.log(
          `${scene}: ${QUESTION_CARD_WIDTHS.length} widths, ${failures.length} card drifts`,
        );
        return { failures, wraps: 0 };
      },
    });
  }
};
