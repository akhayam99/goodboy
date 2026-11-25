// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
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

const isBlockedFor = ({ selector }: TargetParams): ReadonlyArray<boolean> =>
  BRING_HINTS.map((hint) => hint.isBlocked?.({ target: targetOf({ selector }) }) ?? false);

afterEach(() => {
  document.body.innerHTML = '';
});

describe('the bring your work steps', () => {
  it('walks five steps with the rail labels of the plan', () => {
    expect(BRING_HINTS.map((hint) => hint.label)).toEqual([
      'Connect Linear',
      'Open your tasks',
      'Open HBL-412',
      'Start session',
      'Start work',
    ]);
  });

  it('gives each step the instruction of the plan', () => {
    expect(BRING_HINTS.map((hint) => hint.instruction)).toEqual([
      'Press **Paste example key** to connect Linear with a demo key.',
      "Press **Open in Tasks** to see everything Harborline's tools sent.",
      'Press **HBL-412** to read the duplicate credit bug.',
      'Press **Start session** to hand HBL-412 to your agents.',
      'Press **Start** to begin work on HBL-412.',
    ]);
  });

  it('names the Start button the way the draft form does', () => {
    expect(BRING_HINTS.at(-1)?.instruction).toContain(`**${NAMES.start}**`);
  });

  it('offers the example key only on the first step', () => {
    expect(BRING_HINTS.map((hint) => hint.offer?.label ?? null)).toEqual([
      'Paste example key',
      null,
      null,
      null,
      null,
    ]);
    expect(BRING_HINTS[0]?.offer).toMatchObject({
      eyebrow: 'Demo',
      title: 'Paste the example key',
      note: 'A demo key, it only works here',
    });
  });
});

describe('the example key', () => {
  it('lands in the real key field and fires its input event', () => {
    document.body.innerHTML = '<input id="linear-api-key" type="password" />';
    const input = targetOf({ selector: '#linear-api-key' });
    const seen: Array<string> = [];
    input.addEventListener('input', () => {
      if (input instanceof HTMLInputElement) {
        seen.push(input.value);
      }
    });
    BRING_HINTS[0]?.offer?.run({ root: document });
    expect(seen).toEqual([STORY_EXAMPLE_KEY]);
  });

  it('does nothing when the field is not on the page', () => {
    expect(() => BRING_HINTS[0]?.offer?.run({ root: document })).not.toThrow();
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
});
