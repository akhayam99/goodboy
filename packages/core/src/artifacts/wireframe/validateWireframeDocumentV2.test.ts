import { describe, expect, it } from 'vitest';
import { validateWireframeDocument } from './validateWireframeDocument';
import { WIREFRAME_LIMITS, type WireframeDocument, type WireframeNode } from './schema';
import { walkWireframeNodes } from './wireframeNodeChildren';

const v2 = (overrides: Readonly<Record<string, unknown>> = {}) => ({
  version: 2,
  initialScreenId: 'review-batch',
  device: 'desktop',
  theme: { name: 'generic' },
  variants: ['full', 'first-release'],
  patterns: {
    'posting-row': {
      kind: 'stack',
      direction: 'row',
      children: [
        { id: 'title', kind: 'text', text: '{{title}}' },
        { id: 'amount', kind: 'badge', label: '{{amount}}', tone: 'warning' },
      ],
    },
  },
  screens: [
    {
      id: 'review-batch',
      title: 'Review batch',
      note: 'Approve stays locked while an exception is open.',
      states: {
        empty: { hide: ['exception-list'], show: ['all-clear'], label: 'Empty' },
        error: { text: { heading: 'The batch could not load' } },
      },
      root: {
        id: 'root',
        kind: 'stack',
        direction: 'column',
        children: [
          { id: 'heading', kind: 'text', text: 'Review batch 4471', variant: 'title' },
          {
            id: 'exception-list',
            kind: 'card',
            title: 'Exceptions',
            children: [
              {
                use: 'posting-row',
                id: 'row-1',
                with: { title: 'Allocation 1 of 3', amount: '€ 412.34' },
              },
              { use: 'posting-row', with: { title: 'Allocation 2 of 3', amount: '€ 412.33' } },
            ],
          },
          { id: 'all-clear', kind: 'text', text: 'No exceptions', hidden: true },
          { id: 'bulk-approve', kind: 'button', label: 'Approve all', only: ['full'] },
          { id: 'health', kind: 'chart', label: 'Settlement health', chartType: 'line' },
          { id: 'auto', kind: 'toggle', label: 'Auto release', isOn: true },
          {
            id: 'views',
            kind: 'tabs',
            items: [
              { id: 'tab-postings', label: 'Postings', isActive: true },
              { id: 'tab-audit', label: 'Audit' },
            ],
          },
          {
            id: 'reason',
            kind: 'sheet',
            title: 'Send back',
            placement: 'side',
            hidden: true,
            children: [
              { id: 'reason-input', kind: 'input', inputType: 'textarea', label: 'Reason' },
            ],
          },
          {
            id: 'show-empty',
            kind: 'button',
            label: 'Show empty',
            action: { type: 'toggle', stateKey: 'empty' },
          },
        ],
      },
    },
    {
      id: 'audit',
      title: 'Audit',
      device: 'phone',
      root: { id: 'audit-root', kind: 'text', text: 'Audit trail' },
    },
  ],
  transitions: [{ fromNodeId: 'tab-audit', toScreenId: 'audit', label: 'audit' }],
  ...overrides,
});

const valid = (value: unknown): WireframeDocument => {
  const result = validateWireframeDocument({ value });
  if (result.status !== 'valid') {
    throw new Error(result.issues.map((issue) => `${issue.path}: ${issue.message}`).join('\n'));
  }
  return result.document;
};

const issuesOf = (value: unknown): string => {
  const result = validateWireframeDocument({ value });
  if (result.status === 'valid') {
    throw new Error('expected an invalid document');
  }
  return result.issues.map((issue) => `${issue.path}: ${issue.message}`).join('\n');
};

const nodesOf = (document: WireframeDocument): ReadonlyArray<WireframeNode> => {
  const nodes: WireframeNode[] = [];
  for (const screen of document.screens) {
    walkWireframeNodes({ node: screen.root, visit: (node) => nodes.push(node) });
  }
  return nodes;
};

describe('wireframe spec v2', () => {
  it('expands every pattern use with its values and prefixed ids', () => {
    const document = valid(v2());
    const ids = nodesOf(document).map((node) => node.id);
    expect(ids).toContain('row-1');
    expect(ids).toContain('row-1-title');
    expect(ids).toContain('posting-row-2-amount');
    const title = nodesOf(document).find((node) => node.id === 'row-1-title');
    expect(title).toMatchObject({ kind: 'text', text: 'Allocation 1 of 3' });
    expect(nodesOf(document).find((node) => node.id === 'row-1')).toMatchObject({
      pattern: 'posting-row',
    });
  });

  it('refuses a pattern that uses itself, directly or through another', () => {
    const loop = v2({
      patterns: {
        a: { kind: 'stack', direction: 'row', children: [{ use: 'b' }] },
        b: { kind: 'stack', direction: 'row', children: [{ use: 'a' }] },
      },
    });
    const screens = (loop.screens as ReadonlyArray<Record<string, unknown>>).map((screen) => ({
      ...screen,
      root: { use: 'a', id: 'looped' },
    }));
    expect(issuesOf({ ...loop, screens })).toContain('uses itself through a > b > a');
    expect(
      issuesOf(
        v2({
          patterns: {
            ...Object.fromEntries(
              Array.from({ length: WIREFRAME_LIMITS.maxPatterns + 1 }, (_, index) => [
                `p${index}`,
                { kind: 'text', text: 'x' },
              ]),
            ),
          },
        }),
      ),
    ).toContain(`more than the ${WIREFRAME_LIMITS.maxPatterns} pattern limit`);
  });

  it('keeps states, variants, the device and the new kinds', () => {
    const document = valid(v2());
    const [review, audit] = document.screens;
    expect(review?.states?.['empty']).toEqual({
      label: 'Empty',
      hide: ['exception-list'],
      show: ['all-clear'],
      text: {},
    });
    expect(review?.states?.['error']?.label).toBe('Error');
    expect(document.variants).toEqual([
      { id: 'full', label: 'Full' },
      { id: 'first-release', label: 'First release' },
    ]);
    expect(document.device).toBe('desktop');
    expect(review?.viewport).toBe('desktop');
    expect(audit?.viewport).toBe('mobile');
    const kinds = new Set(nodesOf(document).map((node) => node.kind));
    for (const kind of ['card', 'tabs', 'badge', 'toggle', 'sheet', 'chart']) {
      expect(kinds.has(kind as WireframeNode['kind'])).toBe(true);
    }
    expect(nodesOf(document).find((node) => node.id === 'bulk-approve')?.only).toEqual(['full']);
    expect(nodesOf(document).find((node) => node.id === 'all-clear')?.hidden).toBe(true);
  });

  it('refuses a state or a variant that names what does not exist', () => {
    const broken = v2();
    const screens = broken.screens as ReadonlyArray<Record<string, unknown>>;
    const [first, ...rest] = screens;
    expect(
      issuesOf({
        ...broken,
        screens: [{ ...first, states: { empty: { hide: ['audit-root'] } } }, ...rest],
      }),
    ).toContain('no node with id "audit-root" on this screen');
    expect(issuesOf(v2({ variants: ['first-release'] }))).toContain('no variant with id "full"');
    const tooMany = Object.fromEntries(
      Array.from({ length: WIREFRAME_LIMITS.maxStatesPerScreen + 1 }, (_, index) => [
        `s${index}`,
        {},
      ]),
    );
    expect(issuesOf({ ...broken, screens: [{ ...first, states: tooMany }, ...rest] })).toContain(
      `more than the ${WIREFRAME_LIMITS.maxStatesPerScreen} state limit`,
    );
  });

  it('upgrades a version 1 document on read, turning mockState toggles into states', () => {
    const document = valid({
      version: 1,
      initialScreenId: 'inbox',
      theme: { name: 'generic' },
      mockState: { isFilterOpen: false },
      screens: [
        {
          id: 'inbox',
          title: 'Inbox',
          viewport: 'desktop',
          root: {
            id: 'filters',
            kind: 'button',
            label: 'Filters',
            action: { type: 'toggle', stateKey: 'isFilterOpen' },
          },
        },
      ],
      transitions: [],
    });
    expect(document.version).toBe(2);
    expect(document.screens[0]?.states).toEqual({
      isFilterOpen: { label: 'Filter open', hide: [], show: [], text: {} },
    });
    expect('mockState' in document).toBe(false);
  });
});
