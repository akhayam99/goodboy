// @vitest-environment happy-dom
// @vitest-environment-options {"settings":{"navigation":{"disableChildFrameNavigation":true}}}

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { DemoPlayground } from './DemoPlayground';
import { DEMO_CHAPTERS } from './demoChapters';
import { DEMO_PROTOCOL } from './director/demoProtocol';
import { HINT_PROGRESS_KEY } from './hints/hintProgressKey';
import { RESULT_DWELL_MS } from './hints/resultDwellMs';

const STAGE_BOX = new DOMRect(0, 0, 1440, 900);

const railOf = (): HTMLElement => screen.getByRole('navigation', { name: 'Playground groups' });

const visibleFrame = (): HTMLIFrameElement => {
  const frame = document.querySelector<HTMLIFrameElement>('iframe[data-shown="true"]');
  if (frame === null) {
    throw new Error('no visible frame');
  }
  return frame;
};

type ChapterParams = {
  readonly id: string;
};

const chapterOf = ({ id }: ChapterParams) => {
  const chapter = DEMO_CHAPTERS.find((entry) => entry.id === id);
  if (chapter === undefined) {
    throw new Error(`no chapter ${id}`);
  }
  return chapter;
};

type DoneParams = {
  readonly ids: ReadonlyArray<string>;
};

const seedDone = ({ ids }: DoneParams) => {
  window.sessionStorage.setItem(
    HINT_PROGRESS_KEY,
    JSON.stringify(
      Object.fromEntries(
        ids.map((id) => [
          id,
          { tried: chapterOf({ id }).hints.map((entry) => entry.id), epoch: 0 },
        ]),
      ),
    ),
  );
};

const groupRows = (): ReadonlyArray<HTMLButtonElement> =>
  Array.from(railOf().querySelectorAll<HTMLButtonElement>('button[data-access]'));

type RowParams = {
  readonly title: string;
};

const rowOf = ({ title }: RowParams): HTMLButtonElement => {
  const row = groupRows().find((entry) => entry.textContent?.includes(title));
  if (row === undefined) {
    throw new Error(`no row ${title}`);
  }
  return row;
};

const stepRows = (): ReadonlyArray<HTMLElement> =>
  Array.from(railOf().querySelectorAll<HTMLElement>('ol[aria-label="Steps in this group"] li'));

type TriedParams = {
  readonly hintId: string;
};

const frames = (): ReadonlyArray<HTMLIFrameElement> =>
  Array.from(document.querySelectorAll('iframe'));

const readied = new WeakSet<HTMLIFrameElement>();

const ready = () => {
  for (const frame of frames()) {
    if (readied.has(frame)) {
      continue;
    }
    readied.add(frame);
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: {
            channel: DEMO_PROTOCOL.channel,
            version: DEMO_PROTOCOL.version,
            generation: 0,
            type: 'ready',
            elapsedMs: 0,
            durationMs: 0,
            cueIndex: 0,
          },
          origin: window.location.origin,
          source: frame.contentWindow,
        }),
      );
    });
  }
};

const tried = ({ hintId }: TriedParams) => {
  ready();
  for (const frame of frames()) {
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: {
            channel: DEMO_PROTOCOL.channel,
            version: DEMO_PROTOCOL.version,
            generation: 0,
            type: 'tried',
            hintId,
          },
          origin: window.location.origin,
          source: frame.contentWindow,
        }),
      );
    });
  }
};

const finish = ({ id }: ChapterParams) => {
  for (const entry of chapterOf({ id }).hints) {
    tried({ hintId: entry.id });
    act(() => {
      vi.advanceTimersByTime(RESULT_DWELL_MS);
    });
  }
};

beforeEach(() => {
  window.sessionStorage.clear();
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(STAGE_BOX);
  window.history.replaceState(null, '', '/?scene=demo');
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  vi.spyOn(Animation.prototype, 'cancel').mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  window.history.replaceState(null, '', '/');
});

describe('demo rail', () => {
  it('draws one spine with a marker per group and the open group steps on the app rail primitives', () => {
    render(<DemoPlayground />);
    const cells = railOf().querySelectorAll('[data-spawned-rail]');
    expect(cells).toHaveLength(groupRows().length + chapterOf({ id: 'setup' }).hints.length);
    expect(
      railOf().querySelectorAll('[data-testid="timeline-rail-segment"]').length,
    ).toBeGreaterThan(groupRows().length);
    expect(railOf().querySelectorAll('[data-node-size="sm"]')).toHaveLength(
      chapterOf({ id: 'setup' }).hints.length,
    );
  });

  it('lists the steps under the open group only and keeps the other groups to a title and a count', () => {
    seedDone({ ids: ['setup'] });
    window.history.replaceState(null, '', '/?scene=demo#agent');
    render(<DemoPlayground />);
    const steps = within(railOf()).getByRole('list', { name: 'Steps in this group' });
    expect(Array.from(steps.querySelectorAll('li')).map((step) => step.textContent)).toEqual(
      chapterOf({ id: 'agent' }).hints.map((entry) => entry.label),
    );
    expect(within(railOf()).getAllByRole('list')).toHaveLength(1);
    expect(rowOf({ title: 'Set up' }).textContent).toContain(
      `${chapterOf({ id: 'setup' }).hints.length} of ${chapterOf({ id: 'setup' }).hints.length}`,
    );
    expect(rowOf({ title: 'Orchestrate' }).textContent).toContain('Orchestrate');
  });

  it('marks the step in progress as live and the ones after it as next', () => {
    render(<DemoPlayground />);
    const states = stepRows().map((step) => step.getAttribute('data-state'));
    expect(states[0]).toBe('current');
    expect(states.slice(1).every((state) => state === 'todo')).toBe(true);
    expect(stepRows()[0]?.querySelector('[data-node-state="running"]')).not.toBeNull();
    expect(stepRows()[1]?.querySelector('[data-node-state="queued"]')).not.toBeNull();
  });

  it('gives a finished step a check and makes the next step live', () => {
    render(<DemoPlayground />);
    const { hints } = chapterOf({ id: 'setup' });
    tried({ hintId: hints[0]?.id ?? '' });
    expect(stepRows()[0]?.getAttribute('data-state')).toBe('done');
    expect(stepRows()[0]?.querySelector('[data-node-state="done"]')).not.toBeNull();
    expect(stepRows()[1]?.getAttribute('data-state')).toBe('current');
    expect(stepRows()[1]?.querySelector('[data-node-state="running"]')).not.toBeNull();
    expect(stepRows()[1]?.getAttribute('aria-current')).toBe('step');
  });

  it('never makes a step clickable: the path only moves forward', () => {
    render(<DemoPlayground />);
    expect(railOf().querySelectorAll('ol button')).toHaveLength(0);
    const before = visibleFrame();
    fireEvent.click(stepRows()[3] ?? document.body);
    expect(visibleFrame()).toBe(before);
    expect(stepRows()[0]?.getAttribute('data-state')).toBe('current');
  });

  it('locks the groups after the current one: muted, disabled and without a hover state', () => {
    render(<DemoPlayground />);
    for (const title of [
      'Orchestrate',
      'Find work and results',
      'Review and ship',
      'Get Goodboy',
    ]) {
      const row = rowOf({ title });
      expect(row.getAttribute('data-access')).toBe('locked');
      expect(row.disabled).toBe(true);
      fireEvent.click(row);
      expect(window.location.hash).not.toBe(`#${title}`);
    }
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Set up');
    expect(within(rowOf({ title: 'Orchestrate' })).getByText(/Locked/)).not.toBeNull();
  });

  it('keeps the optional Set up open and lets the visitor start at the first required group', () => {
    render(<DemoPlayground />);
    expect(rowOf({ title: 'Set up' }).disabled).toBe(false);
    expect(rowOf({ title: 'Work with an agent' }).disabled).toBe(false);
    fireEvent.click(rowOf({ title: 'Work with an agent' }));
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Work with an agent');
    fireEvent.click(rowOf({ title: 'Set up' }));
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Set up');
  });

  it('keeps a finished group open to revisit and unlocks the next one only when it is done', () => {
    seedDone({ ids: ['setup', 'agent'] });
    window.history.replaceState(null, '', '/?scene=demo#agent');
    render(<DemoPlayground />);
    expect(rowOf({ title: 'Work with an agent' }).getAttribute('data-access')).toBe('done');
    expect(rowOf({ title: 'Work with an agent' }).disabled).toBe(false);
    expect(rowOf({ title: 'Orchestrate' }).getAttribute('data-access')).toBe('open');
    expect(rowOf({ title: 'Find work and results' }).getAttribute('data-access')).toBe('locked');
    expect(stepRows().every((step) => step.getAttribute('data-state') === 'done')).toBe(true);
  });

  it('lights Up next on the next group only once the current one is fully done', () => {
    window.history.replaceState(null, '', '/?scene=demo#agent');
    seedDone({ ids: ['setup'] });
    render(<DemoPlayground />);
    const row = () => rowOf({ title: 'Orchestrate' });
    const { hints } = chapterOf({ id: 'agent' });
    expect(row().getAttribute('data-up-next')).toBe('none');
    for (const entry of hints.slice(0, -1)) {
      tried({ hintId: entry.id });
      act(() => {
        vi.advanceTimersByTime(RESULT_DWELL_MS);
      });
      expect(row().getAttribute('data-up-next')).toBe('none');
      expect(row().textContent).not.toContain('Up next');
    }
    tried({ hintId: hints.at(-1)?.id ?? '' });
    expect(row().getAttribute('data-up-next')).toBe('ready');
    expect(row().getAttribute('data-pulsing')).toBe('true');
    expect(row().textContent).toContain('Up next');
    expect(row().textContent).toContain('Orchestrate');
    act(() => {
      vi.advanceTimersByTime(10000);
    });
    expect(row().getAttribute('data-up-next')).toBe('ready');
    expect(row().getAttribute('data-pulsing')).toBe('false');
    fireEvent.click(row());
    expect(window.location.hash).toBe('#orchestrate');
  });

  it('lights Up next for Set up as soon as its last step is done, with no other group glowing before', () => {
    render(<DemoPlayground />);
    expect(railOf().querySelector('[data-up-next="ready"]')).toBeNull();
    finish({ id: 'setup' });
    expect(rowOf({ title: 'Work with an agent' }).getAttribute('data-up-next')).toBe('ready');
    expect(railOf().querySelectorAll('[data-up-next="ready"]')).toHaveLength(1);
  });

  it('puts Get Goodboy at the end of the spine, locked until Review and ship is done', () => {
    seedDone({ ids: ['setup', 'agent', 'orchestrate', 'find'] });
    window.history.replaceState(null, '', '/?scene=demo#review');
    render(<DemoPlayground />);
    const last = groupRows().at(-1);
    expect(last?.textContent).toContain('Get Goodboy');
    expect(last?.getAttribute('data-access')).toBe('locked');
    expect(last?.disabled).toBe(true);
    expect(last?.getAttribute('data-up-next')).toBe('none');
    finish({ id: 'review' });
    expect(last?.getAttribute('data-access')).toBe('open');
    expect(last?.disabled).toBe(false);
    expect(last?.getAttribute('data-up-next')).toBe('ready');
    expect(last?.textContent).toContain('Up next');
    fireEvent.click(last ?? document.body);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Get Goodboy');
  });

  it('offers a compact group switcher with the current step for narrow windows', () => {
    seedDone({ ids: ['setup', 'agent'] });
    window.history.replaceState(null, '', '/?scene=demo#orchestrate');
    render(<DemoPlayground />);
    const compact = screen.getByRole('navigation', { name: 'Playground navigation' });
    expect(compact.textContent).toContain('Orchestrate');
    expect(compact.textContent).toContain('3 of 5');
    const first = chapterOf({ id: 'orchestrate' }).hints[0];
    expect(within(compact).getByLabelText('Current step').textContent).toBe(
      `Step 1 of ${chapterOf({ id: 'orchestrate' }).hints.length}: ${first?.label}`,
    );
    const next = within(compact).getByRole('button', { name: 'Next group' });
    expect(next.hasAttribute('disabled')).toBe(true);
    fireEvent.click(within(compact).getByRole('button', { name: 'Previous group' }));
    expect(window.location.hash).toBe('#agent');
  });

  it('has no timeline bar at the bottom of the stage', () => {
    render(<DemoPlayground />);
    expect(screen.queryByRole('button', { name: 'Replay group' })).toBeNull();
    expect(screen.queryAllByRole('list', { name: 'Steps in this group' })).toHaveLength(1);
  });
});
