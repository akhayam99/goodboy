export const RUN_TAIL_FIT_SCENES = ['u33-run-stopped-questions'];
export const RUN_TAIL_FIT_WIDTH = 1024;
export const RUN_TAIL_FIT_READY = '[data-question-card]';
export const RUN_TAIL_FIT_TOLERANCE_PX = 1;
export const RUN_TAIL_FIT_FRAME_WIDTH = 680;

export const runTailFitProbe = () => {
  const frame = document.querySelector('[data-shot]');
  const card = document.querySelector('[data-question-card]');
  const rectOf = (element) => {
    const rect = element.getBoundingClientRect();
    return { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right };
  };
  const clippers = [];
  for (let node = card?.parentElement ?? null; node !== null; node = node.parentElement) {
    const style = getComputedStyle(node);
    const clips = [style.overflowX, style.overflowY].some((value) => value !== 'visible');
    if (clips) {
      clippers.push({
        name: node.getAttribute('class')?.slice(0, 60) ?? node.tagName,
        ...rectOf(node),
      });
    }
    if (node === frame) {
      break;
    }
  }
  const tails = frame === null ? [] : [...frame.querySelectorAll('[data-tail]')];
  const hint = frame?.querySelector('[data-run-questions-hint]') ?? null;
  const first = card?.querySelector('h2') ?? null;
  const last = card === null ? null : [...card.querySelectorAll('*')].at(-1);
  return {
    frame: frame === null ? null : { ...rectOf(frame), width: frame.getBoundingClientRect().width },
    card: card === null ? null : rectOf(card),
    cardContent:
      card === null ? null : { scrollHeight: card.scrollHeight, clientHeight: card.clientHeight },
    lastChildBottom: last == null ? null : last.getBoundingClientRect().bottom,
    firstTitleTop: first === null ? null : first.getBoundingClientRect().top,
    clippers,
    tails: tails.map((tail) => ({
      text: tail.textContent?.trim() ?? '',
      ...rectOf(tail),
    })),
    hint:
      hint === null
        ? null
        : {
            text: hint.textContent?.trim() ?? '',
            buttons: [...hint.querySelectorAll('button')].map(
              (button) => button.textContent?.trim() ?? '',
            ),
            ...rectOf(hint),
          },
    answerEnabled:
      card === null
        ? []
        : [...card.querySelectorAll('button')].filter(
            (button) => /^Answer$/.test(button.textContent?.trim() ?? '') && !button.disabled,
          ).length,
    hasComposer: frame?.querySelector('[data-orchestrated-composer]') != null,
    hasChecklist: frame?.querySelector('[data-testid^="run-tree-row-"]') != null,
    hasSidebar: document.querySelector('[data-sidebar], [data-session-rail]') != null,
  };
};

const round = (value) => Math.round(value * 10) / 10;

export const runTailFitFailures = ({
  scene,
  width,
  measured,
  tolerance = RUN_TAIL_FIT_TOLERANCE_PX,
}) => {
  if (measured === null || measured.frame === null || measured.card === null) {
    return [{ scene, width, check: 'the run tail shows a question card inside a data-shot frame' }];
  }
  const failures = [];
  const { frame, card, clippers } = measured;
  if (Math.abs(frame.width - RUN_TAIL_FIT_FRAME_WIDTH) > tolerance) {
    failures.push({
      scene,
      width,
      check: 'the data-shot frame is 680px wide',
      frameWidth: round(frame.width),
    });
  }
  if (card.bottom > frame.bottom + tolerance || card.top < frame.top - tolerance) {
    failures.push({
      scene,
      width,
      check: 'the question card sits inside the frame',
      cardBottom: round(card.bottom),
      frameBottom: round(frame.bottom),
    });
  }
  for (const clipper of clippers) {
    if (card.bottom > clipper.bottom + tolerance || card.top < clipper.top - tolerance) {
      failures.push({
        scene,
        width,
        check: 'no container clips the question card',
        container: clipper.name,
        cardBottom: round(card.bottom),
        containerBottom: round(clipper.bottom),
      });
    }
  }
  if (measured.cardContent.scrollHeight > measured.cardContent.clientHeight + tolerance) {
    failures.push({
      scene,
      width,
      check: 'the question card holds all its content',
      scrollHeight: measured.cardContent.scrollHeight,
      clientHeight: measured.cardContent.clientHeight,
    });
  }
  if (measured.lastChildBottom !== null && measured.lastChildBottom > card.bottom + tolerance) {
    failures.push({
      scene,
      width,
      check: 'the last line of the card sits inside the card',
      lastChildBottom: round(measured.lastChildBottom),
      cardBottom: round(card.bottom),
    });
  }
  const stop = measured.tails.find((tail) => /limit|paused|stopped|failed/i.test(tail.text));
  if (stop === undefined) {
    failures.push({ scene, width, check: 'the stop line shows with the questions' });
  }
  if (measured.hint === null) {
    failures.push({ scene, width, check: 'the questions say how to answer a stopped run' });
  } else {
    if (measured.hint.buttons.length === 0) {
      failures.push({ scene, width, check: 'the stop action sits next to the questions' });
    }
    if (
      measured.hint.top < card.bottom - tolerance ||
      measured.hint.bottom > frame.bottom + tolerance
    ) {
      failures.push({ scene, width, check: 'the hint sits under the card inside the frame' });
    }
  }
  if (measured.answerEnabled > 0) {
    failures.push({
      scene,
      width,
      check: 'no Answer button is enabled on a stopped run',
      enabled: measured.answerEnabled,
    });
  }
  if (!measured.hasComposer) {
    failures.push({ scene, width, check: 'the frame holds the composer' });
  }
  if (!measured.hasChecklist) {
    failures.push({ scene, width, check: 'the frame holds the end of the steps checklist' });
  }
  if (measured.hasSidebar) {
    failures.push({ scene, width, check: 'the frame holds the run tail without the sidebar' });
  }
  return failures;
};

export const runRunTailFit = async ({ send, only, measure, open, run }) => {
  for (const scene of only === undefined || only === 'run-tail' ? RUN_TAIL_FIT_SCENES : []) {
    await measure({
      scene,
      task: async () => {
        await open({
          send,
          scene,
          width: RUN_TAIL_FIT_WIDTH,
          zoom: 1,
          readySelector: RUN_TAIL_FIT_READY,
        });
        const measured = await run(send, runTailFitProbe, null);
        const failures = runTailFitFailures({ scene, width: RUN_TAIL_FIT_WIDTH, measured });
        console.log(
          `${scene}: ${failures.length} failures, frame ${round(measured?.frame?.width ?? 0)}x${round((measured?.frame?.bottom ?? 0) - (measured?.frame?.top ?? 0))}, card ${round(measured?.card?.top ?? 0)}..${round(measured?.card?.bottom ?? 0)}, content ${measured?.cardContent?.scrollHeight}/${measured?.cardContent?.clientHeight}, clippers ${measured?.clippers?.length}, hint "${measured?.hint?.text}" buttons ${measured?.hint?.buttons?.join(',')}, answer enabled ${measured?.answerEnabled}, stop line "${measured?.tails?.map((tail) => tail.text).join(' | ')}"`,
        );
        return { failures, wraps: 0 };
      },
    });
  }
};
