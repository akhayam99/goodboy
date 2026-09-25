import type {
  WireframeAction,
  WireframeInputNode,
  WireframeNode,
  WireframeTransition,
} from '@goodboy/core';
import { escapeHtml } from './escapeHtml';
import { wireframeScreenFile } from './wireframeScreenFile';

export type WireframeLinks = ReadonlyMap<string, string>;

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

type TargetParams = {
  readonly id: string;
  readonly action: WireframeAction | undefined;
  readonly links: WireframeLinks;
};

const targetOf = ({ id, action, links }: TargetParams): string | null => {
  if (action !== undefined && action.type === 'navigate') {
    return action.toScreenId;
  }
  return links.get(id) ?? null;
};

type LinkedParams = {
  readonly className: string;
  readonly target: string | null;
  readonly body: string;
};

const linked = ({ className, target, body }: LinkedParams): string =>
  target === null
    ? `<span class="${className}">${body}</span>`
    : `<a class="${className}" href="${escapeHtml(wireframeScreenFile({ screenId: target }))}">${body}</a>`;

const renderInput = ({ node }: { readonly node: WireframeInputNode }): string => {
  const label =
    node.label === undefined ? '' : `<span class="wf-label">${escapeHtml(node.label)}</span>`;
  const shown = node.placeholder ?? node.options?.[0] ?? '';
  if (node.inputType === 'checkbox') {
    return `<label class="wf-field wf-field-inline"><span class="wf-checkbox"></span>${label}</label>`;
  }
  return `<label class="wf-field">${label}<span class="wf-input wf-input-${node.inputType}">${escapeHtml(shown)}</span></label>`;
};

type RenderParams = {
  readonly node: WireframeNode;
  readonly links: WireframeLinks;
};

export const renderWireframeNode = ({ node, links }: RenderParams): string => {
  const children = ({ list }: { readonly list: ReadonlyArray<WireframeNode> }): string =>
    list.map((child) => renderWireframeNode({ node: child, links })).join('');
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
      return `<div class="${classes.join(' ')}">${children({ list: node.children })}</div>`;
    }
    case 'grid':
      return `<div class="wf-grid wf-cols-${node.columns} wf-gap-${node.gap ?? 'md'} wf-pad-${node.padding ?? 'none'}">${children({ list: node.children })}</div>`;
    case 'text':
      return `<p class="wf-text wf-text-${node.variant ?? 'body'}">${escapeHtml(node.text)}</p>`;
    case 'button':
      return linked({
        className: `wf-button wf-button-${node.variant ?? 'secondary'}`,
        target: targetOf({ id: node.id, action: node.action, links }),
        body: escapeHtml(node.label),
      });
    case 'input':
      return renderInput({ node });
    case 'list': {
      const items = node.items.map((item) => {
        const subtitle =
          item.subtitle === undefined
            ? ''
            : `<span class="wf-list-subtitle">${escapeHtml(item.subtitle)}</span>`;
        return `<li>${linked({
          className: 'wf-list-item',
          target: targetOf({ id: item.id, action: item.action, links }),
          body: `<span class="wf-list-title">${escapeHtml(item.title)}</span>${subtitle}`,
        })}</li>`;
      });
      return `<ul class="wf-list">${items.join('')}</ul>`;
    }
    case 'table': {
      const head = node.columns.map((column) => `<th>${escapeHtml(column)}</th>`).join('');
      const rows = node.rows
        .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`)
        .join('');
      return `<table class="wf-table"><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table>`;
    }
    case 'image':
      return `<div class="wf-image wf-ratio-${node.ratio ?? 'wide'}" role="img" aria-label="${escapeHtml(node.alt)}"><span>${escapeHtml(node.alt)}</span></div>`;
    case 'navigation': {
      const items = node.items.map((item) =>
        linked({
          className: item.isActive === true ? 'wf-nav-item wf-active' : 'wf-nav-item',
          target: targetOf({ id: item.id, action: item.action, links }),
          body: escapeHtml(item.label),
        }),
      );
      return `<nav class="wf-nav wf-nav-${node.variant}">${items.join('')}</nav>`;
    }
    default: {
      const exhaustive: never = node;
      return exhaustive;
    }
  }
};
