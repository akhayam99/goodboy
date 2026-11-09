import type { Plugin } from 'vite';

const DEMO_PLUGIN_NAME = 'goodboy-demo-html';

const INSIGHTS_TAG = '<script defer src="/_vercel/insights/script.js"></script>';

const THEME_SCRIPT = [
  '<script>',
  '(function () {',
  '  try {',
  "    var asked = new URLSearchParams(window.location.search).get('theme');",
  "    var stored = window.localStorage.getItem('goodboy-demo-theme');",
  "    var isKnown = function (value) { return value === 'light' || value === 'dark'; };",
  '    var theme = isKnown(asked) ? asked : isKnown(stored) ? stored : null;',
  '    if (theme === null) { return; }',
  '    var root = document.documentElement;',
  "    root.classList.remove('light', 'dark');",
  '    root.classList.add(theme);',
  '    root.style.colorScheme = theme;',
  "    if (theme === 'light') { root.setAttribute('data-theme', 'light'); }",
  "    else { root.removeAttribute('data-theme'); }",
  '  } catch (error) {}',
  '})();',
  '</script>',
].join('\n');

const BOOT_SHELL = '<div id="boot-shell"><i></i></div>';

const LOADING_LINE = 'Loading the Goodboy demo';

const LOADING_STYLE = [
  '<style>',
  '  #boot-shell p {',
  '    color: CanvasText;',
  '    font: 13px/1.4 system-ui, -apple-system, sans-serif;',
  '    left: 0;',
  '    margin: 0;',
  '    opacity: 0.6;',
  '    position: absolute;',
  '    right: 0;',
  '    text-align: center;',
  '    top: calc(50% + 13px);',
  '  }',
  '</style>',
].join('\n');

type Params = {
  readonly html: string;
};

export const withDemoHead = ({ html }: Params): string =>
  html.includes(INSIGHTS_TAG)
    ? html
    : html
        .replace('</head>', `${LOADING_STYLE}\n${THEME_SCRIPT}\n${INSIGHTS_TAG}\n</head>`)
        .replace(BOOT_SHELL, `<div id="boot-shell"><i></i><p>${LOADING_LINE}</p></div>`);

const demoHtml = (): Plugin => ({
  name: DEMO_PLUGIN_NAME,
  apply: 'build',
  transformIndexHtml: {
    order: 'post',
    handler: (html) => withDemoHead({ html }),
  },
});

type PluginsParams = {
  readonly mode: string;
};

export const demoPlugins = ({ mode }: PluginsParams): ReadonlyArray<Plugin> =>
  mode === 'demo' ? [demoHtml()] : [];
