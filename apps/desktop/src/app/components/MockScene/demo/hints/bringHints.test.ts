// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
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

type MountParams = {
  readonly step: string;
  readonly body: string;
};

const mountStep = ({ step, body }: MountParams): void => {
  document.body.innerHTML = `<div aria-label="Goodboy setup" data-step="${step}">${body}</div>`;
};

const isBlockedFor = ({ selector }: TargetParams): ReadonlyArray<boolean> =>
  BRING_HINTS.map((hint) => hint.isBlocked?.({ target: targetOf({ selector }) }) ?? false);

afterEach(() => {
  document.body.innerHTML = '';
});

describe('the setup group guard', () => {
  it('lets Continue on Agents through after Escape stepped back from Workspace', () => {
    mountStep({
      step: 'agents',
      body: '<button type="button" id="next" data-demo-anchor="setup-continue">Continue</button>',
    });

    expect(isBlockedFor({ selector: '#next' })).toEqual(BRING_HINTS.map(() => false));
  });

  it('lets Connect Linear or Jira through after Escape stepped back from Tools', () => {
    mountStep({
      step: 'first-session',
      body: '<button type="button" id="open" data-demo-anchor="setup-open-tools">Connect Linear or Jira</button>',
    });

    expect(isBlockedFor({ selector: '#open' })).toEqual(BRING_HINTS.map(() => false));
  });

  it('lets Choose folder through when Workspace opens without a folder', () => {
    mountStep({
      step: 'workspace',
      body: '<button type="button" id="pick" data-demo-anchor="setup-choose-folder">Choose folder</button>',
    });

    expect(isBlockedFor({ selector: '#pick' })).toEqual(BRING_HINTS.map(() => false));
  });

  it('still blocks Start and Skip on the first session', () => {
    mountStep({
      step: 'first-session',
      body: [
        '<button type="button" id="start" data-demo-anchor="setup-first-start">Start</button>',
        '<button type="button" id="skip">Skip</button>',
      ].join(''),
    });

    expect(isBlockedFor({ selector: '#start' })).toEqual(BRING_HINTS.map(() => true));
    expect(isBlockedFor({ selector: '#skip' })).toEqual(BRING_HINTS.map(() => true));
  });
});
