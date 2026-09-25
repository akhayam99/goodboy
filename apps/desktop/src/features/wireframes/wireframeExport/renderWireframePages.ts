import type { WireframeDocument, WireframeScreen } from '@goodboy/core';
import { escapeHtml } from './escapeHtml';
import { renderWireframeNode, wireframeLinks } from './renderWireframeNode';
import { WIREFRAME_SCREENS_DIR, wireframeScreenFile } from './wireframeScreenFile';

export const WIREFRAME_CSS_FILE = 'wireframe.css';

type PageParams = {
  readonly title: string;
  readonly stylesheet: string;
  readonly body: string;
};

const page = ({ title, stylesheet, body }: PageParams): string =>
  [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${escapeHtml(title)}</title>`,
    `<link rel="stylesheet" href="${stylesheet}">`,
    '</head>',
    `<body class="wf-page">${body}</body>`,
    '</html>',
    '',
  ].join('\n');

const screenTitle = ({
  document,
  screenId,
}: {
  readonly document: WireframeDocument;
  readonly screenId: string;
}): string => document.screens.find((screen) => screen.id === screenId)?.title ?? screenId;

type ScreenPageParams = {
  readonly document: WireframeDocument;
  readonly screen: WireframeScreen;
  readonly title: string;
};

export const renderWireframeScreenPage = ({
  document,
  screen,
  title,
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
  const outgoing = document.transitions.filter((transition) =>
    screenNodeIds({ screen }).has(transition.fromNodeId),
  );
  const goesTo =
    outgoing.length === 0
      ? ''
      : `<section class="wf-links"><h2>Goes to</h2><ul>${outgoing
          .map(
            (transition) =>
              `<li><a href="${escapeHtml(wireframeScreenFile({ screenId: transition.toScreenId }))}">${escapeHtml(screenTitle({ document, screenId: transition.toScreenId }))}</a> <span class="wf-muted">${escapeHtml(transition.label)}</span></li>`,
          )
          .join('')}</ul></section>`;
  const note =
    screen.note === undefined ? '' : `<p class="wf-muted">${escapeHtml(screen.note)}</p>`;
  const body = [
    `<header class="wf-header"><a href="../index.html">${escapeHtml(title)}</a><span class="wf-muted">${index + 1} of ${document.screens.length}</span>${step({ target: previous, label: 'Previous' })}${step({ target: next, label: 'Next' })}</header>`,
    `<h1 class="wf-screen-title">${escapeHtml(screen.title)}</h1>`,
    note,
    `<main class="wf-screen wf-viewport-${screen.viewport}">${renderWireframeNode({
      node: screen.root,
      links: wireframeLinks({ transitions: document.transitions }),
    })}</main>`,
    goesTo,
  ].join('');
  return page({
    title: `${screen.title} · ${title}`,
    stylesheet: `../${WIREFRAME_CSS_FILE}`,
    body,
  });
};

const screenNodeIds = ({ screen }: { readonly screen: WireframeScreen }): ReadonlySet<string> => {
  const ids = new Set<string>();
  const visit = ({ node }: { readonly node: WireframeScreen['root'] }): void => {
    ids.add(node.id);
    if (node.kind === 'stack' || node.kind === 'grid') {
      node.children.forEach((child) => visit({ node: child }));
    }
    if (node.kind === 'list' || node.kind === 'navigation') {
      node.items.forEach((item) => ids.add(item.id));
    }
  };
  visit({ node: screen.root });
  return ids;
};

type IndexPageParams = {
  readonly document: WireframeDocument;
  readonly title: string;
};

export const renderWireframeIndexPage = ({ document, title }: IndexPageParams): string => {
  const href = ({ screenId }: { readonly screenId: string }): string =>
    escapeHtml(`${WIREFRAME_SCREENS_DIR}/${wireframeScreenFile({ screenId })}`);
  const flow = document.transitions
    .map((transition) => {
      const from =
        document.screens.find((screen) => screenNodeIds({ screen }).has(transition.fromNodeId)) ??
        null;
      const fromCell =
        from === null
          ? `<span class="wf-muted">${escapeHtml(transition.fromNodeId)}</span>`
          : `<a href="${href({ screenId: from.id })}">${escapeHtml(from.title)}</a>`;
      return `<tr><td>${fromCell}</td><td><a href="${href({ screenId: transition.toScreenId })}">${escapeHtml(screenTitle({ document, screenId: transition.toScreenId }))}</a></td><td>${escapeHtml(transition.label)}</td></tr>`;
    })
    .join('');
  const flowTable =
    flow.length === 0
      ? '<p class="wf-muted">No transitions between screens.</p>'
      : `<table class="wf-table"><thead><tr><th>From</th><th>To</th><th>When</th></tr></thead><tbody>${flow}</tbody></table>`;
  const tiles = document.screens
    .map(
      (screen) =>
        `<li><a class="wf-tile" href="${href({ screenId: screen.id })}"><span class="wf-tile-title">${escapeHtml(screen.title)}</span><span class="wf-muted">${screen.viewport}${screen.id === document.initialScreenId ? ' · start' : ''}</span></a></li>`,
    )
    .join('');
  const body = [
    `<header class="wf-header"><h1 class="wf-screen-title">${escapeHtml(title)}</h1><span class="wf-muted">${document.screens.length} screens</span></header>`,
    `<section class="wf-links"><h2>Flow</h2>${flowTable}</section>`,
    `<section class="wf-links"><h2>Screens</h2><ul class="wf-tiles">${tiles}</ul></section>`,
  ].join('');
  return page({ title, stylesheet: WIREFRAME_CSS_FILE, body });
};
