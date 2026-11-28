// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { NAMES } from '../../../../../shared/utils/names';
import { STORY_EXAMPLE_KEY } from '../../scenes/story/storyTasks';
import { BRING_HINTS } from './bringHints';

type TargetParams = {
  readonly selector: string;
};

const targetOf = ({ selector }: TargetParams): Element => {
  const target = document.querySelector(selector);
  if (target === null) {
    throw new Error(`no ${selector}`);
  }
  return target;
};

type HintParams = {
  readonly id: string;
};

const hintOf = ({ id }: HintParams) => {
  const hint = BRING_HINTS.find((entry) => entry.id === id);
  if (hint === undefined) {
    throw new Error(`no hint ${id}`);
  }
  return hint;
};

const isBlockedFor = ({ selector }: TargetParams): ReadonlyArray<boolean> =>
  BRING_HINTS.map((hint) => hint.isBlocked?.({ target: targetOf({ selector }) }) ?? false);

afterEach(() => {
  document.body.innerHTML = '';
  vi.useRealTimers();
});

describe('the bring your work steps', () => {
  it('walks the setup, the key and the task to start with the rail labels of the plan', () => {
    expect(BRING_HINTS.map((hint) => hint.label)).toEqual([
      'Sign in Codex',
      'Keep Claude as default',
      'Create Harborline',
      'Open the issue sources',
      'Open Linear',
      'Add the Linear key',
      'Open your tasks',
      'Open HBL-412',
      'Start session',
      'Start work',
    ]);
  });

  it('gives each step the instruction of the plan', () => {
    expect(BRING_HINTS.map((hint) => hint.instruction)).toEqual([
      'Press **Sign in** on Codex to add a second agent.',
      'Press **Continue** to keep Claude as your default agent.',
      'Press **Create** to keep these three repositories together in Harborline.',
      "Press **Connect Linear or Jira** to bring Harborline's issues into Goodboy.",
      'Press **Connect** on Linear to bring its issues into Goodboy.',
      'Press **Paste example key** to connect Linear with a demo key.',
      "Press **Continue** to see everything Harborline's tools sent.",
      'Press **HBL-412** to read the duplicate credit bug.',
      'Press **Start session** to hand HBL-412 to your agents.',
      'Press **Start** to begin work on HBL-412.',
    ]);
  });

  it('names the Start button the way the draft form does', () => {
    expect(BRING_HINTS.at(-1)?.instruction).toContain(`**${NAMES.start}**`);
  });

  it('offers the example key only on the key step', () => {
    expect(BRING_HINTS.filter((hint) => hint.offer !== undefined).map((hint) => hint.id)).toEqual([
      'bring-connect',
    ]);
    expect(hintOf({ id: 'bring-connect' }).offer).toMatchObject({
      eyebrow: 'Demo',
      title: 'Paste the example key',
      label: 'Paste example key',
      note: 'A demo key, it only works here',
    });
  });

  it('keeps the background sharp while the list of tools and the Continue step show', () => {
    expect(hintOf({ id: 'setup-tools' }).isDimmed).toBe(false);
    expect(hintOf({ id: 'setup-tools' }).focus).toBe('[data-testid="wizard-column"]');
  });
});

describe('the example key', () => {
  it('goes into the real key field in pieces and fires an input event for each', () => {
    vi.useFakeTimers();
    document.body.innerHTML = '<input id="linear-api-key" type="password" />';
    const input = targetOf({ selector: '#linear-api-key' });
    const seen: Array<string> = [];
    input.addEventListener('input', () => {
      if (input instanceof HTMLInputElement) {
        seen.push(input.value);
      }
    });
    hintOf({ id: 'bring-connect' }).offer?.run({ root: document });
    expect(seen).toEqual([]);
    vi.advanceTimersByTime(60_000);
    expect(seen.length).toBeGreaterThan(5);
    expect(seen.at(-1)).toBe(STORY_EXAMPLE_KEY);
    expect(
      seen.every((value, index) => index === 0 || value.startsWith(seen[index - 1] ?? '')),
    ).toBe(true);
  });

  it('types the key once when it is pressed twice', () => {
    vi.useFakeTimers();
    document.body.innerHTML = '<input id="linear-api-key" type="password" />';
    const input = targetOf({ selector: '#linear-api-key' });
    let count = 0;
    input.addEventListener('input', () => {
      count += 1;
    });
    hintOf({ id: 'bring-connect' }).offer?.run({ root: document });
    vi.advanceTimersByTime(100);
    hintOf({ id: 'bring-connect' }).offer?.run({ root: document });
    vi.advanceTimersByTime(60_000);
    expect(count).toBe(Math.ceil(STORY_EXAMPLE_KEY.length / 2));
  });

  it('does nothing when the field is not on the page', () => {
    expect(() => hintOf({ id: 'bring-connect' }).offer?.run({ root: document })).not.toThrow();
  });
});

describe('the guard path', () => {
  it('blocks every control and task row that is not the step target', () => {
    document.body.innerHTML = [
      '<button type="button" id="other">Disconnect</button>',
      '<div role="option" id="row" aria-label="HBL-409 Statement export drops the last day">row</div>',
      '<p id="text">text</p>',
    ].join('');
    expect(isBlockedFor({ selector: '#other' })).toEqual(BRING_HINTS.map(() => true));
    expect(isBlockedFor({ selector: '#row' })).toEqual(BRING_HINTS.map(() => true));
    expect(isBlockedFor({ selector: '#text' })).toEqual(BRING_HINTS.map(() => false));
  });

  it('lets each setup step through its own control and blocks the control of the next one', () => {
    document.body.innerHTML = [
      '<div aria-label="Goodboy setup" data-step="tools">',
      '<button type="button" id="connect" aria-label="Connect Linear">Connect</button>',
      '<button type="button" id="continue" data-demo-anchor="setup-continue">Continue</button>',
      '</div>',
    ].join('');
    const connect = targetOf({ selector: '#connect' });
    const next = targetOf({ selector: '#continue' });
    const blockedBy = ({ id, target }: { readonly id: string; readonly target: Element }) =>
      hintOf({ id }).isBlocked?.({ target });
    expect(blockedBy({ id: 'setup-linear', target: connect })).toBe(false);
    expect(blockedBy({ id: 'setup-linear', target: next })).toBe(true);
    expect(blockedBy({ id: 'setup-tools', target: next })).toBe(false);
    expect(blockedBy({ id: 'setup-tools', target: connect })).toBe(true);
  });
});
