import { useEffect } from 'react';
import type { BrowserPaneSceneState } from '../browserPaneSeed';

type Params = {
  readonly isOn: boolean;
  readonly state: BrowserPaneSceneState;
};

const PANE = '[aria-label="Browser"]';

const SELECTORS: Readonly<Partial<Record<BrowserPaneSceneState, string>>> = {
  address: `${PANE} button[aria-label^="Edit address"]`,
  more: `${PANE} button[aria-label="More"]`,
};

export const useOpenedChrome = ({ isOn, state }: Params): void => {
  useEffect(() => {
    const selector = SELECTORS[state];
    if (!isOn || selector === undefined) {
      return;
    }
    let frame = 0;
    const look = () => {
      const button = document.querySelector<HTMLButtonElement>(selector);
      if (button === null) {
        frame = window.requestAnimationFrame(look);
        return;
      }
      button.click();
    };
    frame = window.requestAnimationFrame(look);
    return () => window.cancelAnimationFrame(frame);
  }, [isOn, state]);
};
