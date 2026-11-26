import { useEffect } from 'react';
import { SHORTCUTS, platformCombo } from '../../../../../../../shared/keyboard/registry';
import { currentPlatform } from '../../../../../../../shared/platform';
import type { BrowserPaneSceneState } from '../browserPaneSeed';

type Params = {
  readonly isOn: boolean;
  readonly state: BrowserPaneSceneState;
};

type TypeParams = {
  readonly field: HTMLInputElement;
  readonly text: string;
};

const PANE = '[aria-label="Browser"]';
const PILL = `${PANE} button[aria-label^="Edit address"]`;
const FIELD = `${PANE} input[role="combobox"]`;
const FIND_FIELD = `${PANE} input[aria-label="Find in page"]`;

const SELECTORS: Readonly<Partial<Record<BrowserPaneSceneState, string>>> = {
  address: PILL,
  field: PILL,
  more: `${PANE} button[aria-label="More"]`,
  handoff: `${PANE} button[aria-label="More"]`,
  console: `${PANE} button[aria-label="Console"]`,
  pick: `${PANE} button[aria-label="Select an element"]`,
  'console-right': `${PANE} button[aria-label="Console"]`,
  network: `${PANE} button[aria-label="Console"]`,
  'network-detail': `${PANE} button[aria-label="Console"]`,
  errors: `${PANE} button[data-browser-errors]`,
};

const TOOLS = `${PANE} section[aria-label="Console"]`;

const OPENED: Readonly<Partial<Record<BrowserPaneSceneState, string>>> = {
  console: TOOLS,
  'console-right': TOOLS,
  network: TOOLS,
  'network-detail': TOOLS,
  errors: TOOLS,
  pick: `${PANE} [aria-label="Note for the picked element"]`,
};

const NETWORK_TAB = `${TOOLS} [role="tablist"][aria-label="Tools"] [role="tab"][aria-selected="false"]`;

const NEXT_CLICKS: Readonly<Partial<Record<BrowserPaneSceneState, ReadonlyArray<string>>>> = {
  network: [NETWORK_TAB],
  'network-detail': [NETWORK_TAB, `${TOOLS} button[aria-label="POST /api/charge, 500"]`],
};

const FIELDS: Readonly<Partial<Record<BrowserPaneSceneState, string>>> = {
  find: FIND_FIELD,
  'find-missing': FIND_FIELD,
};

const TYPED: Readonly<Partial<Record<BrowserPaneSceneState, string>>> = {
  field: 'check',
  find: 'retry',
  'find-missing': 'zebra',
};

const FIND_STATES: ReadonlyArray<BrowserPaneSceneState> = ['find', 'find-missing'];

const typeInto = ({ field, text }: TypeParams): void => {
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  setValue?.call(field, text);
  field.dispatchEvent(new Event('input', { bubbles: true }));
};

const pressFind = (): void => {
  const parts = platformCombo({ entry: SHORTCUTS['browser.find'] }).split('+');
  const isMac = currentPlatform() === 'darwin';
  const isModWanted = parts.includes('cmd');
  document.dispatchEvent(
    new KeyboardEvent('keydown', {
      code: parts[parts.length - 1] ?? '',
      key: 'f',
      metaKey: isMac && isModWanted,
      ctrlKey: parts.includes('ctrl') || (!isMac && isModWanted),
      shiftKey: parts.includes('shift'),
      altKey: parts.includes('alt'),
      bubbles: true,
    }),
  );
};

export const useOpenedChrome = ({ isOn, state }: Params): void => {
  useEffect(() => {
    const selector = SELECTORS[state];
    const isFind = FIND_STATES.includes(state);
    if (!isOn || (selector === undefined && !isFind)) {
      return;
    }
    const text = TYPED[state];
    const opened = OPENED[state];
    const fieldSelector = FIELDS[state] ?? FIELD;
    let frame = 0;
    let clicks = NEXT_CLICKS[state] ?? [];
    const clickNext = () => {
      const [next, ...rest] = clicks;
      if (next === undefined) {
        return;
      }
      const target = document.querySelector<HTMLElement>(next);
      if (target !== null) {
        target.click();
        clicks = rest;
      }
      frame = window.requestAnimationFrame(clickNext);
    };
    const typeText = () => {
      const field = document.querySelector<HTMLInputElement>(fieldSelector);
      if (field === null) {
        frame = window.requestAnimationFrame(typeText);
        return;
      }
      typeInto({ field, text: text ?? '' });
    };
    const look = () => {
      if (isFind) {
        if (document.querySelector(fieldSelector) === null) {
          pressFind();
          frame = window.requestAnimationFrame(look);
          return;
        }
        typeText();
        return;
      }
      const button =
        selector === undefined ? null : document.querySelector<HTMLButtonElement>(selector);
      if (button === null) {
        frame = window.requestAnimationFrame(look);
        return;
      }
      if (opened !== undefined) {
        if (
          document.querySelector(opened) === null &&
          button.getAttribute('aria-pressed') !== 'true'
        ) {
          button.click();
        }
        frame = window.requestAnimationFrame(
          document.querySelector(opened) === null ? look : clickNext,
        );
        return;
      }
      button.click();
      if (text !== undefined) {
        frame = window.requestAnimationFrame(typeText);
      }
    };
    frame = window.requestAnimationFrame(look);
    return () => window.cancelAnimationFrame(frame);
  }, [isOn, state]);
};
