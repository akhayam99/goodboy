import { useEffect } from 'react';
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

const SELECTORS: Readonly<Partial<Record<BrowserPaneSceneState, string>>> = {
  address: PILL,
  field: PILL,
  more: `${PANE} button[aria-label="More"]`,
};

const TYPED: Readonly<Partial<Record<BrowserPaneSceneState, string>>> = {
  field: 'check',
};

const typeInto = ({ field, text }: TypeParams): void => {
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  setValue?.call(field, text);
  field.dispatchEvent(new Event('input', { bubbles: true }));
};

export const useOpenedChrome = ({ isOn, state }: Params): void => {
  useEffect(() => {
    const selector = SELECTORS[state];
    if (!isOn || selector === undefined) {
      return;
    }
    const text = TYPED[state];
    let frame = 0;
    const typeText = () => {
      const field = document.querySelector<HTMLInputElement>(FIELD);
      if (field === null) {
        frame = window.requestAnimationFrame(typeText);
        return;
      }
      typeInto({ field, text: text ?? '' });
    };
    const look = () => {
      const button = document.querySelector<HTMLButtonElement>(selector);
      if (button === null) {
        frame = window.requestAnimationFrame(look);
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
