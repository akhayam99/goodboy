export const ROW_ALIGN_SCENES = ['u33-overview-needs-you'];
export const ROW_ALIGN_WIDTH = 1024;
export const ROW_ALIGN_READY = '[data-action-card]';
export const ROW_ALIGN_TOLERANCE_PX = 1;

export const rowAlignProbe = () => {
  const sideOf = ({ rows, glyph, scope }) => {
    const first = rows[0];
    const left = first?.querySelector(glyph)?.getBoundingClientRect().left ?? null;
    const gaps = [];
    rows.forEach((row, index) => {
      const next = rows[index + 1];
      if (next !== undefined && row.closest(scope) === next.closest(scope)) {
        gaps.push(next.getBoundingClientRect().top - row.getBoundingClientRect().bottom);
      }
    });
    return { count: rows.length, left, gaps };
  };
  const needs = [
    ...document.querySelectorAll('[data-overview-card="needs-you"] [data-action-card]'),
  ];
  const waiting = [...document.querySelectorAll('[data-running-rows] [data-live-row]')].filter(
    (row) => row.closest('[data-live-child]') === null,
  );
  const frame = document.querySelector('[data-shot]');
  const lastRow = waiting[waiting.length - 1];
  const neighbours = [...(frame?.querySelectorAll('[data-overview-card]') ?? [])].filter(
    (card) =>
      !['needs-you', 'running'].includes(card.getAttribute('data-overview-card') ?? '') &&
      card.getClientRects().length > 0,
  );
  return {
    needs: sideOf({ rows: needs, glyph: '[data-live-glyph]', scope: '[data-next-group]' }),
    waiting: sideOf({ rows: waiting, glyph: '[data-live-glyph]', scope: '[data-live-section]' }),
    frame: {
      width: frame?.getBoundingClientRect().width ?? null,
      bottom: frame?.getBoundingClientRect().bottom ?? null,
      lastRowBottom: lastRow?.getBoundingClientRect().bottom ?? null,
      neighbours: neighbours.length,
    },
  };
};

const round = (value) => Math.round(value * 10) / 10;

export const rowAlignFailures = ({
  scene,
  width,
  measured,
  tolerance = ROW_ALIGN_TOLERANCE_PX,
}) => {
  const failures = [];
  const { needs, waiting } = measured;
  if (needs.count === 0 || waiting.count === 0 || needs.left === null || waiting.left === null) {
    return [{ scene, width, check: 'no Needs you row and Waiting for you row to compare' }];
  }
  if (Math.abs(needs.left - waiting.left) > tolerance) {
    failures.push({
      scene,
      width,
      check: 'the icon of a Needs you row does not line up with the icon of a Waiting for you row',
      needsLeft: round(needs.left),
      waitingLeft: round(waiting.left),
    });
  }
  const { frame } = measured;
  if (frame.width === null || frame.lastRowBottom === null) {
    failures.push({ scene, width, check: 'no data-shot frame around the two sections' });
  } else if (frame.lastRowBottom > frame.bottom + tolerance) {
    failures.push({
      scene,
      width,
      check: 'the frame cuts off the last Waiting for you row',
      frameBottom: round(frame.bottom),
      lastRowBottom: round(frame.lastRowBottom),
    });
  }
  if (frame.neighbours > 0) {
    failures.push({
      scene,
      width,
      check: 'the frame shows a card next to Needs you and Waiting for you',
      neighbours: frame.neighbours,
    });
  }
  const gaps = [...needs.gaps, ...waiting.gaps];
  if (needs.gaps.length === 0 || waiting.gaps.length === 0) {
    failures.push({ scene, width, check: 'a section has no two rows to measure a gap between' });
    return failures;
  }
  const lowest = Math.min(...gaps);
  const highest = Math.max(...gaps);
  if (highest - lowest > tolerance) {
    failures.push({
      scene,
      width,
      check: 'the row gap of Needs you differs from the row gap of Waiting for you',
      needsGaps: needs.gaps.map(round),
      waitingGaps: waiting.gaps.map(round),
    });
  }
  return failures;
};

export const runRowAlign = async ({ send, only, measure, open, run }) => {
  for (const scene of only === undefined || only === 'row-align' ? ROW_ALIGN_SCENES : []) {
    await measure({
      scene,
      task: async () => {
        await open({
          send,
          scene,
          width: ROW_ALIGN_WIDTH,
          zoom: 1,
          readySelector: ROW_ALIGN_READY,
        });
        const measured = await run(send, rowAlignProbe, null);
        const failures = rowAlignFailures({ scene, width: ROW_ALIGN_WIDTH, measured });
        console.log(
          `${scene}: icons and row gaps compared, ${failures.length} misalignments (needs gaps ${measured.needs.gaps.map(round)}, waiting gaps ${measured.waiting.gaps.map(round)})`,
        );
        return { failures, wraps: 0 };
      },
    });
  }
};
