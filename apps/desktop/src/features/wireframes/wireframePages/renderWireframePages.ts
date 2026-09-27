import type { WireframeDocument, WireframeScreen } from '@goodboy/core';
import { screenLinks, screenNodeNotes } from '../wireframeNotes';
import { escapeHtml } from './escapeHtml';
import {
  renderWireframeNode,
  STATE_FILE_SEPARATOR,
  type WireframeDiffMarks,
  wireframeLinks,
  wireframeStateScreens,
} from './renderWireframeNode';
import { WIREFRAME_SCREENS_DIR, wireframeScreenFile } from './wireframeScreenFile';

export const WIREFRAME_CSS_FILE = 'wireframe.css';

const CSP =
  "default-src 'none'; style-src 'self' file: gbframe: http://gbframe.localhost; script-src gbframe: http://gbframe.localhost; img-src data:";

type PageParams = {
  readonly title: string;
  readonly stylesheet: string;
  readonly body: string;
};

export const wireframePage = ({ title, stylesheet, body }: PageParams): string =>
  [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8">',
    `<meta http-equiv="Content-Security-Policy" content="${CSP}">`,
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${escapeHtml(title)}</title>`,
    `<link rel="stylesheet" href="${stylesheet}">`,
    '</head>',
    `<body class="wf-page">${body}</body>`,
    '</html>',
    '',
  ].join('\n');

const stateFile = ({
  screenId,
  state,
}: {
  readonly screenId: string;
  readonly state: string | null;
}): string =>
  wireframeScreenFile({
    screenId: state === null ? screenId : `${screenId}${STATE_FILE_SEPARATOR}${state}`,
  });

export const screenStateFiles = ({
  screen,
}: {
  readonly screen: WireframeScreen;
}): ReadonlyArray<Readonly<{ state: string | null; file: string }>> => [
  { state: null, file: stateFile({ screenId: screen.id, state: null }) },
  ...Object.keys(screen.states ?? {}).map((state) => ({
    state,
    file: stateFile({ screenId: screen.id, state }),
  })),
];

type ScreenPageParams = {
  readonly document: WireframeDocument;
  readonly screen: WireframeScreen;
  readonly state: string | null;
  readonly title: string;
  readonly marks?: WireframeDiffMarks;
};

const NO_MARKS: WireframeDiffMarks = new Map();

const stateSwitch = ({
  screen,
  state,
}: {
  readonly screen: WireframeScreen;
  readonly state: string | null;
}): string => {
  const entries = Object.entries(screen.states ?? {});
  if (entries.length === 0) {
    return '';
  }
  const link = ({
    target,
    label,
  }: {
    readonly target: string | null;
    readonly label: string;
  }): string =>
    target === state
      ? `<span class="wf-state wf-active" aria-current="page">${escapeHtml(label)}</span>`
      : `<a class="wf-state" href="${escapeHtml(stateFile({ screenId: screen.id, state: target }))}">${escapeHtml(label)}</a>`;
  return `<nav class="wf-states wf-page-chrome" aria-label="States">${[
    link({ target: null, label: 'Default' }),
    ...entries.map(([id, entry]) => link({ target: id, label: entry.label })),
  ].join('')}</nav>`;
};

const notesPanel = ({
  document,
  screen,
}: {
  readonly document: WireframeDocument;
  readonly screen: WireframeScreen;
}): string => {
  const notes = screenNodeNotes({ screen });
  const links = screenLinks({ document, screen });
  if (notes.length === 0 && links.length === 0 && screen.note === undefined) {
    return '';
  }
  const note =
    screen.note === undefined ? '' : `<p class="wf-muted">${escapeHtml(screen.note)}</p>`;
  const list =
    notes.length === 0
      ? ''
      : `<ol class="wf-note-list">${notes
          .map(
            (entry) =>
              `<li value="${entry.number}"><a href="#${escapeHtml(entry.nodeId)}">${escapeHtml(entry.label)}</a> ${escapeHtml(entry.note)}</li>`,
          )
          .join('')}</ol>`;
  const goes =
    links.length === 0
      ? ''
      : `<h2>Goes to</h2><ul>${links
          .map(
            (entry) =>
              `<li><a href="${escapeHtml(wireframeScreenFile({ screenId: entry.toScreenId }))}">${entry.toNumber} ${escapeHtml(entry.toTitle)}</a> <span class="wf-muted">${escapeHtml(entry.label)}</span></li>`,
          )
          .join('')}</ul>`;
  return `<details class="wf-notes wf-page-chrome" open><summary>Notes</summary>${note}${list}${goes}</details>`;
};

export const renderWireframeScreenPage = ({
  document,
  screen,
  state,
  title,
  marks = NO_MARKS,
}: ScreenPageParams): string => {
  const index = document.screens.findIndex((entry) => entry.id === screen.id);
  const previous = document.screens[index - 1] ?? null;
  const next = document.screens[index + 1] ?? null;
  const step = ({
    target,
    label,
  }: {
    readonly target: WireframeScreen | null;
    readonly label: string;
  }): string =>
    target === null
      ? `<span class="wf-step wf-step-off">${label}</span>`
      : `<a class="wf-step" href="${escapeHtml(wireframeScreenFile({ screenId: target.id }))}">${label}: ${escapeHtml(target.title)}</a>`;
  const stateEntry = state === null ? null : (screen.states?.[state] ?? null);
  const noteNumbers = new Map(
    screenNodeNotes({ screen }).map((entry) => [entry.nodeId, entry.number]),
  );
  const heading = stateEntry === null ? screen.title : `${screen.title} · ${stateEntry.label}`;
  const body = [
    `<header class="wf-header wf-page-chrome"><a href="../index.html">${escapeHtml(title)}</a><span class="wf-muted">${index + 1} of ${document.screens.length}</span>${step({ target: previous, label: 'Previous' })}${step({ target: next, label: 'Next' })}</header>`,
    `<h1 class="wf-screen-title wf-page-chrome">${escapeHtml(heading)}</h1>`,
    stateSwitch({ screen, state: stateEntry === null ? null : state }),
    `<div class="wf-layout"><main class="wf-screen wf-viewport-${screen.viewport}">${renderWireframeNode(
      {
        node: screen.root,
        ctx: {
          links: wireframeLinks({ transitions: document.transitions }),
          stateScreens: wireframeStateScreens({ document }),
          state: stateEntry,
          noteNumbers,
          marks,
        },
      },
    )}</main>${notesPanel({ document, screen })}</div>`,
  ].join('');
  return wireframePage({
    title: `${heading} · ${title}`,
    stylesheet: `../${WIREFRAME_CSS_FILE}`,
    body,
  });
};

type IndexPageParams = {
  readonly document: WireframeDocument;
  readonly title: string;
  readonly subtitle?: string;
  readonly homeHref?: string;
};

export const renderWireframeIndexPage = ({
  document,
  title,
  subtitle,
  homeHref,
}: IndexPageParams): string => {
  const href = ({ screenId }: { readonly screenId: string }): string =>
    escapeHtml(`${WIREFRAME_SCREENS_DIR}/${wireframeScreenFile({ screenId })}`);
  const screenOfNode = new Map<string, WireframeScreen>();
  for (const screen of document.screens) {
    for (const link of screenLinks({ document, screen })) {
      screenOfNode.set(link.nodeId, screen);
    }
  }
  const titleOf = ({ screenId }: { readonly screenId: string }): string =>
    document.screens.find((screen) => screen.id === screenId)?.title ?? screenId;
  const flow = document.transitions
    .map((transition) => {
      const from = screenOfNode.get(transition.fromNodeId) ?? null;
      const fromCell =
        from === null
          ? `<span class="wf-muted">${escapeHtml(transition.fromNodeId)}</span>`
          : `<a href="${href({ screenId: from.id })}">${escapeHtml(from.title)}</a>`;
      return `<tr><td>${fromCell}</td><td><a href="${href({ screenId: transition.toScreenId })}">${escapeHtml(titleOf({ screenId: transition.toScreenId }))}</a></td><td>${escapeHtml(transition.label)}</td></tr>`;
    })
    .join('');
  const flowTable =
    flow.length === 0
      ? '<p class="wf-muted">No transitions between screens.</p>'
      : `<table class="wf-table"><thead><tr><th>From</th><th>To</th><th>When</th></tr></thead><tbody>${flow}</tbody></table>`;
  const tiles = document.screens
    .map((screen, index) => {
      const states = Object.keys(screen.states ?? {}).length;
      const extra = states === 0 ? '' : ` · +${states} ${states === 1 ? 'state' : 'states'}`;
      return `<li><a class="wf-tile" href="${href({ screenId: screen.id })}"><span class="wf-tile-title">${index + 1} ${escapeHtml(screen.title)}</span><span class="wf-muted">${screen.viewport}${screen.id === document.initialScreenId ? ' · start' : ''}${extra}</span></a></li>`;
    })
    .join('');
  const home = homeHref === undefined ? '' : `<a href="${escapeHtml(homeHref)}">All versions</a>`;
  const body = [
    `<header class="wf-header">${home}<h1 class="wf-screen-title">${escapeHtml(title)}</h1><span class="wf-muted">${escapeHtml(subtitle ?? `${document.screens.length} screens`)}</span></header>`,
    `<section class="wf-links"><h2>Flow</h2>${flowTable}</section>`,
    `<section class="wf-links"><h2>Screens</h2><ul class="wf-tiles">${tiles}</ul></section>`,
  ].join('');
  return wireframePage({ title, stylesheet: WIREFRAME_CSS_FILE, body });
};
