import type { ComponentType } from 'react';
import { BrowserPaneScene } from './BrowserPaneScene';

export const BROWSER_PANE_SCENES: Readonly<Record<string, ComponentType>> = {
  'browser-pane': () => <BrowserPaneScene state="pane" theme="light" />,
  'browser-pane-dark': () => <BrowserPaneScene state="pane" theme="dark" />,
  'browser-pane-passkey': () => <BrowserPaneScene state="passkey" theme="light" />,
  'browser-pane-passkey-dark': () => <BrowserPaneScene state="passkey" theme="dark" />,
  'browser-pane-tabs': () => <BrowserPaneScene state="tabs" theme="light" />,
  'browser-pane-tabs-dark': () => <BrowserPaneScene state="tabs" theme="dark" />,
  'browser-pane-rail': () => <BrowserPaneScene state="rail" theme="light" />,
  'browser-pane-rail-dark': () => <BrowserPaneScene state="rail" theme="dark" />,
  'browser-page': () => <BrowserPaneScene state="page" theme="light" />,
  'browser-page-dark': () => <BrowserPaneScene state="page" theme="dark" />,
  'browser-peek': () => <BrowserPaneScene state="peek" theme="light" />,
  'browser-peek-dark': () => <BrowserPaneScene state="peek" theme="dark" />,
};
