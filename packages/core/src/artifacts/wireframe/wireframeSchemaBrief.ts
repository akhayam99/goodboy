import {
  WIREFRAME_BUTTON_VARIANTS,
  WIREFRAME_IMAGE_RATIOS,
  WIREFRAME_INPUT_TYPES,
  WIREFRAME_LIMITS,
  WIREFRAME_NAVIGATION_VARIANTS,
  WIREFRAME_SCHEMA_VERSION,
  WIREFRAME_TEXT_VARIANTS,
  WIREFRAME_THEME_COLOR_TOKENS,
  WIREFRAME_VIEWPORTS,
} from './schema';

const EXAMPLE = {
  version: WIREFRAME_SCHEMA_VERSION,
  initialScreenId: 'inbox',
  theme: { name: 'generic', font: 'sans', radius: 'md' },
  mockState: { isFilterOpen: false },
  screens: [
    {
      id: 'inbox',
      title: 'Inbox',
      viewport: 'desktop',
      root: {
        id: 'inbox-root',
        kind: 'stack',
        direction: 'column',
        gap: 'md',
        padding: 'lg',
        children: [
          {
            id: 'inbox-nav',
            kind: 'navigation',
            variant: 'top',
            items: [
              { id: 'nav-inbox', label: 'Inbox', isActive: true },
              { id: 'nav-archive', label: 'Archive' },
            ],
          },
          { id: 'inbox-heading', kind: 'text', text: 'Inbox', variant: 'title' },
          {
            id: 'inbox-list',
            kind: 'list',
            items: [
              {
                id: 'inbox-item-1',
                title: 'Release 0.3.0 is ready',
                subtitle: '2 minutes ago',
                action: { type: 'navigate', toScreenId: 'message' },
              },
            ],
          },
          {
            id: 'inbox-filter',
            kind: 'button',
            label: 'Filters',
            variant: 'ghost',
            action: { type: 'toggle', stateKey: 'isFilterOpen' },
          },
        ],
      },
    },
    {
      id: 'message',
      title: 'Message',
      viewport: 'desktop',
      root: {
        id: 'message-root',
        kind: 'stack',
        direction: 'column',
        gap: 'sm',
        padding: 'lg',
        children: [
          { id: 'message-subject', kind: 'text', text: 'Release 0.3.0 is ready', variant: 'title' },
          { id: 'message-hero', kind: 'image', alt: 'release chart placeholder', ratio: 'wide' },
          { id: 'message-back', kind: 'button', label: 'Back to inbox', variant: 'secondary' },
        ],
      },
    },
  ],
  transitions: [{ fromNodeId: 'inbox-item-1', toScreenId: 'message', label: 'open message' }],
};

export const WIREFRAME_SCHEMA_BRIEF = [
  `the wireframe document is one JSON object: { "version": ${WIREFRAME_SCHEMA_VERSION}, "initialScreenId", "theme", "screens", "transitions", "mockState" }.`,
  `screens is an array of { id, title, viewport, root, note? }; viewport is one of ${WIREFRAME_VIEWPORTS.join(', ')}. at most ${WIREFRAME_LIMITS.maxScreens} screens, ${WIREFRAME_LIMITS.maxNodes} nodes in total and ${WIREFRAME_LIMITS.maxDepth} levels of nesting.`,
  'every node is { id, kind, ... } with a unique id of letters, digits, dashes or underscores starting with a letter. the kinds are closed:',
  '- stack: direction row|column, gap, padding, align, justify, surface, children',
  '- grid: columns 1 to 6, gap, padding, children',
  `- text: text, variant ${WIREFRAME_TEXT_VARIANTS.join('|')}`,
  `- button: label, variant ${WIREFRAME_BUTTON_VARIANTS.join('|')}, optional action`,
  `- input: inputType ${WIREFRAME_INPUT_TYPES.join('|')}, label, placeholder, options`,
  '- list: items [{ id, title, subtitle, action }]',
  '- table: columns [string], rows [[string]] with one cell per column',
  `- image: alt, ratio ${WIREFRAME_IMAGE_RATIOS.join('|')}. it is always a placeholder box, never a real asset`,
  `- navigation: variant ${WIREFRAME_NAVIGATION_VARIANTS.join('|')}, items [{ id, label, isActive, action }]`,
  'an action is { "type": "navigate", "toScreenId": "<declared screen id>" } or { "type": "toggle", "stateKey": "<key declared in mockState>" }. nothing else is an action.',
  'transitions is an array of { fromNodeId, toScreenId, label }; fromNodeId must be a node in the document and toScreenId a declared screen.',
  `theme is { name, font sans|serif|mono, radius none|sm|md|lg|full, colors, sources }. colors only accepts the tokens ${WIREFRAME_THEME_COLOR_TOKENS.join(', ')} with hex values like #1a1a1a. name the theme "generic" whenever you were not handed a real design profile.`,
  'forbidden everywhere: unknown properties, html, css, scripts, inline handlers, external or data urls, component imports, styling strings. any of them rejects the whole document.',
  'a valid example:',
  JSON.stringify(EXAMPLE, null, 2),
].join('\n');
