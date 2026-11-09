import type { ComponentType } from 'react';
import { BrowserPaneScene } from './BrowserPaneScene';

export const BROWSER_PANE_SCENES: Readonly<Record<string, ComponentType>> = {
  'browser-pane': () => <BrowserPaneScene state="pane" theme="light" />,
  'browser-pane-dark': () => <BrowserPaneScene state="pane" theme="dark" />,
  'browser-pane-tabs': () => <BrowserPaneScene state="tabs" theme="light" />,
  'browser-pane-tabs-dark': () => <BrowserPaneScene state="tabs" theme="dark" />,
};
