import type {
  WireframeAction,
  WireframeDocument,
  WireframeInputNode,
  WireframeNavigationItem,
  WireframeNode,
  WireframeScreenState,
  WireframeTransition,
} from '@goodboy/core';
import { escapeHtml } from './escapeHtml';
import { wireframeScreenFile } from './wireframeScreenFile';

export type WireframeLinks = ReadonlyMap<string, string>;

export type WireframeRenderContext = Readonly<{
  links: WireframeLinks;
  stateScreens: ReadonlyMap<string, string>;
  state: WireframeScreenState | null;
  noteNumbers: ReadonlyMap<string, number>;
}>;

export const STATE_FILE_SEPARATOR = '--';

export const wireframeLinks = ({
  transitions,
}: {
  readonly transitions: ReadonlyArray<WireframeTransition>;
}): WireframeLinks => {
  const links = new Map<string, string>();
  for (const transition of transitions) {
    if (!links.has(transition.fromNodeId)) {
      links.set(transition.fromNodeId, transition.toScreenId);
    }
  }
  return links;
};

export const wireframeStateScreens = ({
  document,
}: {
  readonly document: WireframeDocument;
}): ReadonlyMap<string, string> => {
  const owners = new Map<string, string>();
  for (const screen of document.screens) {
    for (const key of Object.keys(screen.states ?? {})) {
      if (!owners.has(key)) {
        owners.set(key, screen.id);
      }
    }
  }
  return owners;
};

type AttributeParams = {
  readonly id: string;
  readonly kind: string;
  readonly ctx: WireframeRenderContext;
};

export const nodeAttributes = ({ id, kind, ctx }: AttributeParams): string => {
  const note = ctx.noteNumbers.get(id);
  const noteAttribute = note === undefined ? '' : ` data-note="${note}"`;
  return ` id="${escapeHtml(id)}" data-node="${escapeHtml(id)}" data-kind="${kind}"${noteAttribute}`;
};

const onlyClasses = ({ only }: { readonly only: ReadonlyArray<string> | undefined }): string =>
  only === undefined || only.length === 0
    ? ''
    : ` wf-only ${only.map((variant) => `wf-only-${escapeHtml(variant)}`).join(' ')}`;

const targetOf = ({
  id,
  action,
  ctx,
}: {
  readonly id: string;
  readonly action: WireframeAction | undefined;
  readonly ctx: WireframeRenderContext;
}): string | null => {
  if (action !== undefined && action.type === 'navigate') {
    return wireframeScreenFile({ screenId: action.toScreenId });
  }
  if (action !== undefined && action.type === 'toggle') {
    const owner = ctx.stateScreens.get(action.stateKey);
    return owner === undefined
      ? null
      : wireframeScreenFile({ screenId: `${owner}${STATE_FILE_SEPARATOR}${action.stateKey}` });
  }
  const screenId = ctx.links.get(id);
  return screenId === undefined ? null : wireframeScreenFile({ screenId });
};

type LinkedParams = {
  readonly className: string;
  readonly target: string | null;
  readonly body: string;
  readonly attributes: string;
};

const linked = ({ className, target, body, attributes }: LinkedParams): string =>
  target === null
    ? `<span class="${className}"${attributes}>${body}</span>`
    : `<a class="${className}"${attributes} href="${escapeHtml(target)}">${body}</a>`;

const isShown = ({
  id,
  hidden,
  state,
}: {
  readonly id: string;
  readonly hidden: boolean;
  readonly state: WireframeScreenState | null;
}): boolean => {
  if (state !== null && state.hide.includes(id)) {
    return false;
  }
  if (hidden) {
    return state !== null && state.show.includes(id);
  }
  return true;
};

const textOf = ({
  id,
  value,
  ctx,
}: {
  readonly id: string;
  readonly value: string;
  readonly ctx: WireframeRenderContext;
}): string => escapeHtml(ctx.state?.text[id] ?? value);

const renderInput = ({
  node,
  attributes,
  ctx,
}: {
  readonly node: WireframeInputNode;
  readonly attributes: string;
  readonly ctx: WireframeRenderContext;
}): string => {
  const label =
    node.label === undefined
      ? ''
      : `<span class="wf-label">${textOf({ id: node.id, value: node.label, ctx })}</span>`;
  const shown = node.placeholder ?? node.options?.[0] ?? '';
  const only = onlyClasses({ only: node.only });
  if (node.inputType === 'checkbox') {
    return `<label class="wf-field wf-field-inline${only}"${attributes}><span class="wf-checkbox"></span>${label}</label>`;
  }
  return `<label class="wf-field${only}"${attributes}>${label}<span class="wf-input wf-input-${node.inputType}">${escapeHtml(shown)}</span></label>`;
};

const renderItems = ({
  items,
  className,
  itemClass,
  attributes,
  ctx,
}: {
  readonly items: ReadonlyArray<WireframeNavigationItem>;
  readonly className: string;
  readonly itemClass: string;
  readonly attributes: string;
  readonly ctx: WireframeRenderContext;
}): string => {
  const rendered = items.map((item) =>
    linked({
      className: item.isActive === true ? `${itemClass} wf-active` : itemClass,
      target: targetOf({ id: item.id, action: item.action, ctx }),
      body: textOf({ id: item.id, value: item.label, ctx }),
      attributes: nodeAttributes({ id: item.id, kind: 'item', ctx }),
    }),
  );
  return `<nav class="${className}"${attributes}>${rendered.join('')}</nav>`;
};

type RenderParams = {
  readonly node: WireframeNode;
  readonly ctx: WireframeRenderContext;
};

export const renderWireframeNode = ({ node, ctx }: RenderParams): string => {
  if (!isShown({ id: node.id, hidden: node.hidden === true, state: ctx.state })) {
    return '';
  }
  const children = ({ list }: { readonly list: ReadonlyArray<WireframeNode> }): string =>
    list.map((child) => renderWireframeNode({ node: child, ctx })).join('');
  const attributes = nodeAttributes({ id: node.id, kind: node.kind, ctx });
  const only = onlyClasses({ only: node.only });
  switch (node.kind) {
    case 'stack': {
      const classes = [
        'wf-stack',
        `wf-dir-${node.direction}`,
        `wf-gap-${node.gap ?? 'md'}`,
        `wf-pad-${node.padding ?? 'none'}`,
        `wf-align-${node.align ?? 'stretch'}`,
        `wf-justify-${node.justify ?? 'start'}`,
        ...(node.surface === true ? ['wf-surface'] : []),
      ];
      return `<div class="${classes.join(' ')}${only}"${attributes}>${children({ list: node.children })}</div>`;
    }
    case 'grid':
      return `<div class="wf-grid wf-cols-${node.columns} wf-gap-${node.gap ?? 'md'} wf-pad-${node.padding ?? 'none'}${only}"${attributes}>${children({ list: node.children })}</div>`;
    case 'card': {
      const title =
        node.title === undefined
          ? ''
          : `<p class="wf-card-title">${textOf({ id: node.id, value: node.title, ctx })}</p>`;
      return `<section class="wf-card wf-pad-${node.padding ?? 'md'}${only}"${attributes}>${title}${children({ list: node.children })}</section>`;
    }
    case 'sheet': {
      const title =
        node.title === undefined
          ? ''
          : `<p class="wf-card-title">${textOf({ id: node.id, value: node.title, ctx })}</p>`;
      return `<div class="wf-sheet wf-sheet-${node.placement ?? 'modal'}${only}"${attributes}><div class="wf-sheet-body">${title}${children({ list: node.children })}</div></div>`;
    }
    case 'text':
      return `<p class="wf-text wf-text-${node.variant ?? 'body'}${only}"${attributes}>${textOf({ id: node.id, value: node.text, ctx })}</p>`;
    case 'button':
      return linked({
        className: `wf-button wf-button-${node.variant ?? 'secondary'}${only}`,
        target: targetOf({ id: node.id, action: node.action, ctx }),
        body: textOf({ id: node.id, value: node.label, ctx }),
        attributes,
      });
    case 'badge':
      return `<span class="wf-badge wf-badge-${node.tone ?? 'neutral'}${only}"${attributes}>${textOf({ id: node.id, value: node.label, ctx })}</span>`;
    case 'toggle':
      return `<span class="wf-toggle${node.isOn === true ? ' wf-toggle-on' : ''}${only}"${attributes}><span class="wf-toggle-track"></span>${textOf({ id: node.id, value: node.label, ctx })}</span>`;
    case 'chart':
      return `<div class="wf-chart wf-chart-${node.chartType ?? 'bar'}${only}"${attributes} role="img" aria-label="${escapeHtml(node.label)}"><span>${textOf({ id: node.id, value: node.label, ctx })}</span></div>`;
    case 'input':
      return renderInput({ node, attributes, ctx });
    case 'list': {
      const items = node.items.map((item) => {
        const subtitle =
          item.subtitle === undefined
            ? ''
            : `<span class="wf-list-subtitle">${escapeHtml(item.subtitle)}</span>`;
        return `<li>${linked({
          className: 'wf-list-item',
          target: targetOf({ id: item.id, action: item.action, ctx }),
          body: `<span class="wf-list-title">${textOf({ id: item.id, value: item.title, ctx })}</span>${subtitle}`,
          attributes: nodeAttributes({ id: item.id, kind: 'item', ctx }),
        })}</li>`;
      });
      return `<ul class="wf-list${only}"${attributes}>${items.join('')}</ul>`;
    }
    case 'table': {
      const head = node.columns.map((column) => `<th>${escapeHtml(column)}</th>`).join('');
      const rows = node.rows
        .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`)
        .join('');
      return `<table class="wf-table${only}"${attributes}><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table>`;
    }
    case 'image':
      return `<div class="wf-image wf-ratio-${node.ratio ?? 'wide'}${only}"${attributes} role="img" aria-label="${escapeHtml(node.alt)}"><span>${escapeHtml(node.alt)}</span></div>`;
    case 'navigation':
      return renderItems({
        items: node.items,
        className: `wf-nav wf-nav-${node.variant}${only}`,
        itemClass: 'wf-nav-item',
        attributes,
        ctx,
      });
    case 'tabs':
      return renderItems({
        items: node.items,
        className: `wf-tabs${only}`,
        itemClass: 'wf-tab',
        attributes,
        ctx,
      });
    default: {
      const exhaustive: never = node;
      return exhaustive;
    }
  }
};
