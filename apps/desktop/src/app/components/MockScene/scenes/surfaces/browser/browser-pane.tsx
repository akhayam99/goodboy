import type { ComponentType } from 'react';
import { BrowserPaneScene } from './BrowserPaneScene';

export const BROWSER_PANE_SCENES: Readonly<Record<string, ComponentType>> = {
  'browser-pane': () => <BrowserPaneScene state="pane" theme="light" />,
  'browser-pane-dark': () => <BrowserPaneScene state="pane" theme="dark" />,
  'browser-pane-address': () => <BrowserPaneScene state="address" theme="light" />,
  'browser-pane-address-dark': () => <BrowserPaneScene state="address" theme="dark" />,
  'browser-pane-more': () => <BrowserPaneScene state="more" theme="light" />,
  'browser-pane-more-dark': () => <BrowserPaneScene state="more" theme="dark" />,
  'browser-pane-loading': () => <BrowserPaneScene state="loading" theme="light" />,
  'browser-pane-loading-dark': () => <BrowserPaneScene state="loading" theme="dark" />,
  'browser-pane-tabs': () => <BrowserPaneScene state="tabs" theme="light" />,
  'browser-pane-tabs-dark': () => <BrowserPaneScene state="tabs" theme="dark" />,
  'browser-page': () => <BrowserPaneScene state="page" theme="light" />,
  'browser-page-dark': () => <BrowserPaneScene state="page" theme="dark" />,
  'browser-peek': () => <BrowserPaneScene state="peek" theme="light" />,
  'browser-peek-dark': () => <BrowserPaneScene state="peek" theme="dark" />,
};
