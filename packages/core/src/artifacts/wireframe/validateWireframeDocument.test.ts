import { describe, expect, it } from 'vitest';
import { MAX_WIREFRAME_ADJUSTMENTS, WIREFRAME_LIMITS, type WireframeAdjustment } from './schema';
import { parseWireframeSource, validateWireframeDocument } from './validateWireframeDocument';
import { WIREFRAME_SCHEMA_BRIEF } from './wireframeSchemaBrief';

const text = ({ id, value }: { readonly id: string; readonly value: string }) => ({
  id,
  kind: 'text',
  text: value,
});

const validDocument = () => ({
  version: 1,
  initialScreenId: 'home',
  theme: { name: 'generic', font: 'sans', radius: 'md', colors: { accent: '#3355ff' } },
  mockState: { isDrawerOpen: false },
  screens: [
    {
      id: 'home',
      title: 'Home',
      viewport: 'desktop',
      root: {
        id: 'home-root',
        kind: 'stack',
        direction: 'column',
        gap: 'md',
        children: [
          {
            id: 'home-nav',
            kind: 'navigation',
            variant: 'top',
            items: [{ id: 'nav-home', label: 'Home', isActive: true }],
          },
          text({ id: 'home-title', value: 'Sessions' }),
          {
            id: 'home-grid',
            kind: 'grid',
            columns: 2,
            children: [
              { id: 'home-image', kind: 'image', alt: 'chart placeholder', ratio: 'wide' },
              {
                id: 'home-table',
                kind: 'table',
                columns: ['session', 'state'],
                rows: [['ship reports', 'done']],
              },
            ],
          },
          {
            id: 'home-list',
            kind: 'list',
            items: [
              {
                id: 'home-list-1',
                title: 'Open the detail',
                action: { type: 'navigate', toScreenId: 'detail' },
              },
            ],
          },
          {
            id: 'home-input',
            kind: 'input',
            inputType: 'select',
            label: 'Filter',
            options: ['all', 'open'],
          },
          {
            id: 'home-cta',
            kind: 'button',
            label: 'Open detail',
            variant: 'primary',
            action: { type: 'navigate', toScreenId: 'detail' },
          },
          {
            id: 'home-drawer-toggle',
            kind: 'button',
            label: 'Toggle drawer',
            action: { type: 'toggle', stateKey: 'isDrawerOpen' },
          },
        ],
      },
    },
    {
      id: 'detail',
      title: 'Detail',
      viewport: 'desktop',
      root: text({ id: 'detail-title', value: 'Detail' }),
    },
  ],
  transitions: [{ fromNodeId: 'home-cta', toScreenId: 'detail', label: 'open detail' }],
});

const invalidOf = (value: unknown) => {
  const result = validateWireframeDocument({ value });
  if (result.status === 'valid') {
    throw new Error('expected an invalid document');
  }
  return result.issues.map((issue) => `${issue.path}: ${issue.message}`).join(' | ');
};

const validOf = (value: unknown) => {
  const result = validateWireframeDocument({ value });
  if (result.status !== 'valid') {
    throw new Error(`expected a valid document, got ${JSON.stringify(result.issues)}`);
  }
  return result;
};

const adjustmentsOf = (result: { readonly adjustments: ReadonlyArray<WireframeAdjustment> }) =>
  result.adjustments
    .map((entry) =>
      entry.change === 'hidden'
        ? `hidden: ${entry.moved} moved, ${entry.dropped} dropped`
        : `${entry.path}: ${entry.message}`,
    )
    .join(' | ');

type ValidResult = { readonly adjustments: ReadonlyArray<WireframeAdjustment> };

const listedAt = ({ result, index }: { readonly result: ValidResult; readonly index: number }) => {
  const entry = result.adjustments[index];
  if (entry === undefined || entry.change === 'hidden') {
    throw new Error(`expected a listed adjustment at ${index}`);
  }
  return entry;
};

const hiddenOf = ({ result }: { readonly result: ValidResult }) => {
  const entry = result.adjustments[result.adjustments.length - 1];
  if (entry === undefined || entry.change !== 'hidden') {
    throw new Error('expected a hidden summary row');
  }
  return entry;
};

describe('validateWireframeDocument', () => {
  it('accepts a complete document and normalizes defaults', () => {
    const result = validateWireframeDocument({ value: validDocument() });
    expect(result.status).toBe('valid');
    if (result.status !== 'valid') {
      return;
    }
    expect(result.document.initialScreenId).toBe('home');
    expect(result.document.screens).toHaveLength(2);
    expect(result.document.transitions[0]?.toScreenId).toBe('detail');
    expect(result.document.theme.colors?.accent).toBe('#3355ff');
    const root = result.document.screens[0]?.root;
    expect(root?.kind === 'stack' && root.padding).toBe('none');
  });

  it('rejects a non-object payload', () => {
    expect(invalidOf('screens')).toContain('expected a wireframe object');
  });

  it('rejects an unsupported version', () => {
    expect(invalidOf({ ...validDocument(), version: 2 })).toContain('expected version 1');
  });

  it('drops an unknown property at every level and reports where it was', () => {
    const rogue = validOf({ ...validDocument(), onLoad: 'fetch()' });
    expect(adjustmentsOf(rogue)).toContain('.onLoad: is not part of the wireframe contract');

    const nested = validDocument();
    nested.screens[1] = {
      ...nested.screens[1],
      root: { ...text({ id: 'detail-title', value: 'Detail' }), style: 'color:red', width: 320 },
    } as never;
    const result = validOf(nested);
    const reported = adjustmentsOf(result);
    expect(reported).toContain('screens[1].root.style: is not part of the wireframe contract');
    expect(reported).toContain('screens[1].root.width: is not part of the wireframe contract');
    const root = result.document.screens[1]?.root;
    expect(root === undefined ? [] : Object.keys(root)).toEqual(['id', 'kind', 'text', 'variant']);
  });

  it('drops markup that arrives on an unknown property instead of rendering it', () => {
    const doc = validDocument();
    doc.screens[1] = {
      ...doc.screens[1],
      root: {
        ...text({ id: 'detail-title', value: 'Detail' }),
        onClick: '<script>alert(1)</script>',
      },
    } as never;
    const result = validOf(doc);
    expect(JSON.stringify(result.document)).not.toContain('script');
    expect(adjustmentsOf(result)).toContain('screens[1].root.onClick');
  });

  it('draws a navigation item whose isActive is not a boolean as inactive', () => {
    const doc = validDocument();
    doc.screens[1] = {
      ...doc.screens[1],
      root: {
        id: 'detail-nav',
        kind: 'navigation',
        variant: 'top',
        items: [{ id: 'detail-nav-home', label: 'Home', isActive: 'yes' }],
      },
    } as never;
    const result = validOf(doc);
    const root = result.document.screens[1]?.root;
    expect(root?.kind === 'navigation' && root.items[0]?.isActive).toBe(false);
    expect(adjustmentsOf(result)).toContain(
      'screens[1].root.items[0].isActive: "yes" is not true or false',
    );
  });

  it('rejects an unknown node kind', () => {
    const doc = validDocument();
    doc.screens[1] = {
      ...doc.screens[1],
      root: { id: 'iframe-node', kind: 'iframe' },
    } as never;
    expect(invalidOf(doc)).toContain('expected one of stack, grid, text');
  });

  it('rejects raw html, scripts, css and external urls in text', () => {
    const hostile = [
      '<script>alert(1)</script>',
      '<img src=x onerror=alert(1)>',
      'javascript:alert(1)',
      'https://example.com/tracker.png',
      'data:text/html;base64,PHNjcmlwdD4=',
      '.title { color: red }',
      'background: url(https://x.test/a.png)',
    ];
    for (const value of hostile) {
      const doc = validDocument();
      doc.screens[1] = {
        ...doc.screens[1],
        root: text({ id: 'detail-title', value }),
      } as never;
      expect(invalidOf(doc)).toMatch(/not allowed/);
    }
  });

  it('rejects duplicate node ids and duplicate screen ids', () => {
    const dupNode = validDocument();
    dupNode.screens[1] = {
      ...dupNode.screens[1],
      root: text({ id: 'home-title', value: 'Detail' }),
    } as never;
    expect(invalidOf(dupNode)).toContain('duplicate node id');

    const dupScreen = validDocument();
    dupScreen.screens[1] = { ...dupScreen.screens[1], id: 'home' } as never;
    expect(invalidOf(dupScreen)).toContain('duplicate screen id');
  });

  it('rejects a transition or an action pointing at an undeclared screen', () => {
    const transition = validDocument();
    transition.transitions = [
      { fromNodeId: 'home-cta', toScreenId: 'ghost', label: 'nowhere' },
    ] as never;
    expect(invalidOf(transition)).toContain('no screen with id "ghost"');

    const action = validDocument();
    action.screens[1] = {
      ...action.screens[1],
      root: {
        id: 'detail-cta',
        kind: 'button',
        label: 'go',
        action: { type: 'navigate', toScreenId: 'ghost' },
      },
    } as never;
    expect(invalidOf(action)).toContain('undeclared screen "ghost"');
  });

  it('rejects a transition from an unknown node and an undeclared mock state toggle', () => {
    const transition = validDocument();
    transition.transitions = [
      { fromNodeId: 'ghost-node', toScreenId: 'detail', label: 'nowhere' },
    ] as never;
    expect(invalidOf(transition)).toContain('no node with id "ghost-node"');

    const toggle = validDocument();
    toggle.mockState = {} as never;
    expect(invalidOf(toggle)).toContain('undeclared mock state "isDrawerOpen"');
  });

  it('rejects a transition whose source node cannot be clicked', () => {
    const doc = validDocument();
    doc.transitions = [
      { fromNodeId: 'home-title', toScreenId: 'detail', label: 'open detail' },
    ] as never;
    expect(invalidOf(doc)).toContain('cannot start a transition');
  });

  it('accepts a transition on a clickable node that carries no inline action', () => {
    const doc = validDocument();
    doc.transitions = [
      { fromNodeId: 'nav-home', toScreenId: 'detail', label: 'open detail' },
    ] as never;
    const result = validateWireframeDocument({ value: doc });
    expect(result.status).toBe('valid');
  });

  it('rejects a node that two definitions would give different actions', () => {
    const againstInline = validDocument();
    againstInline.transitions = [
      { fromNodeId: 'home-cta', toScreenId: 'home', label: 'back home' },
    ] as never;
    expect(invalidOf(againstInline)).toContain('two different actions');

    const twoTransitions = validDocument();
    twoTransitions.transitions = [
      { fromNodeId: 'nav-home', toScreenId: 'detail', label: 'open detail' },
      { fromNodeId: 'nav-home', toScreenId: 'home', label: 'back home' },
    ] as never;
    expect(invalidOf(twoTransitions)).toContain('two different actions');
  });

  it('rejects an initialScreenId that names no screen', () => {
    expect(invalidOf({ ...validDocument(), initialScreenId: 'ghost' })).toContain(
      'no screen with id "ghost"',
    );
  });

  it('rejects more screens than the limit', () => {
    const doc = validDocument();
    doc.screens = Array.from({ length: WIREFRAME_LIMITS.maxScreens + 1 }, (_unused, index) => ({
      id: `screen-${index}`,
      title: `Screen ${index}`,
      viewport: 'desktop',
      root: text({ id: `screen-${index}-title`, value: 'x' }),
    })) as never;
    doc.initialScreenId = 'screen-0';
    doc.transitions = [] as never;
    doc.mockState = {} as never;
    expect(invalidOf(doc)).toContain('more than the 12 screen limit');
  });

  it('rejects nesting deeper than the depth limit', () => {
    let node: Record<string, unknown> = text({ id: 'leaf', value: 'deep' });
    for (let index = 0; index < WIREFRAME_LIMITS.maxDepth + 1; index += 1) {
      node = { id: `wrap-${index}`, kind: 'stack', direction: 'column', children: [node] };
    }
    const doc = validDocument();
    doc.screens[1] = { ...doc.screens[1], root: node } as never;
    expect(invalidOf(doc)).toContain('nesting deeper than the 12 level limit');
  });

  it('rejects more nodes than the limit', () => {
    const children = Array.from({ length: WIREFRAME_LIMITS.maxNodes + 4 }, (_unused, index) =>
      text({ id: `node-${index}`, value: 'x' }),
    );
    const doc = validDocument();
    doc.screens[1] = {
      ...doc.screens[1],
      root: { id: 'big-root', kind: 'stack', direction: 'column', children },
    } as never;
    expect(invalidOf(doc)).toContain('more than the 500 node limit');
  });

  it('drops a theme color that is not a hex value instead of losing the document', () => {
    const doc = validDocument();
    doc.theme = { name: 'brand', colors: { accent: 'var(--brand)' } } as never;
    const result = validateWireframeDocument({ value: doc });
    expect(result.status).toBe('valid');
    if (result.status !== 'valid') {
      return;
    }
    expect(result.document.theme.colors).toBeUndefined();
    expect(adjustmentsOf(result)).toContain(
      'theme.colors.accent: "var(--brand)" is not a hex color',
    );
  });

  it('rejects a table row whose cell count does not match the columns', () => {
    const doc = validDocument();
    doc.screens[1] = {
      ...doc.screens[1],
      root: { id: 'detail-table', kind: 'table', columns: ['a', 'b'], rows: [['only one']] },
    } as never;
    expect(invalidOf(doc)).toContain('expected 2 cells');
  });

  it('coerces a spacing outside the enum at every depth and still returns a document', () => {
    const doc = validDocument();
    const root = doc.screens[0]?.root as Record<string, unknown>;
    root['gap'] = 'xl';
    const children = root['children'] as Array<Record<string, unknown>>;
    children.push({
      id: 'home-footer',
      kind: 'stack',
      direction: 'row',
      gap: 'xs',
      children: [
        { id: 'home-footer-note', kind: 'text', text: 'All set' },
        {
          id: 'home-footer-actions',
          kind: 'stack',
          direction: 'row',
          gap: 24,
          children: [{ id: 'home-footer-save', kind: 'button', label: 'Save' }],
        },
      ],
    });
    const result = validOf(doc);
    const home = result.document.screens[0]?.root;
    expect(home?.kind === 'stack' && home.gap).toBe('lg');
    const footer = home?.kind === 'stack' ? home.children[7] : undefined;
    expect(footer?.kind === 'stack' && footer.gap).toBe('sm');
    const actions = footer?.kind === 'stack' ? footer.children[1] : undefined;
    expect(actions?.kind === 'stack' && actions.gap).toBe('lg');
    const reported = adjustmentsOf(result);
    expect(reported).toContain('screens[0].root.gap: "xl" is not one of none, sm, md, lg');
    expect(reported).toContain('screens[0].root.children[7].gap');
    expect(reported).toContain('screens[0].root.children[7].children[1].gap');
    expect(reported).toContain('so it was drawn as');
  });

  it('moves a spacing to the nearest value the wireframe can draw', () => {
    const cases: ReadonlyArray<readonly [unknown, string]> = [
      ['xs', 'sm'],
      ['xl', 'lg'],
      ['2xl', 'lg'],
      ['medium', 'md'],
      [0, 'none'],
      [4, 'sm'],
      [16, 'md'],
      [64, 'lg'],
      ['12px', 'md'],
      [{ size: 4 }, 'md'],
    ];
    for (const [raw, expected] of cases) {
      const doc = validDocument();
      (doc.screens[0]?.root as Record<string, unknown>)['gap'] = raw;
      const root = validOf(doc).document.screens[0]?.root;
      expect(root?.kind === 'stack' && root.gap).toBe(expected);
    }
  });

  it('keeps a structural error fatal even when a presentation value was adjusted', () => {
    const doc = validDocument();
    (doc.screens[0]?.root as Record<string, unknown>)['gap'] = 'xl';
    doc.screens[1] = {
      ...doc.screens[1],
      root: { id: 'detail-frame', kind: 'iframe' },
    } as never;
    const issues = invalidOf(doc);
    expect(issues).toContain('expected one of stack, grid, text');
    expect(issues).not.toContain('"xl"');
  });

  it('coerces every presentation value the model can miss', () => {
    const doc = validDocument();
    doc.theme = { name: 'brand', font: 'monospace', radius: 'pill' } as never;
    const home = doc.screens[0] as Record<string, unknown>;
    home['viewport'] = 'phone';
    const root = home['root'] as Record<string, unknown>;
    root['direction'] = 'vertical';
    root['align'] = 'flex-start';
    root['justify'] = 'space-between';
    root['surface'] = 'yes';
    const children = root['children'] as Array<Record<string, unknown>>;
    (children[0] as Record<string, unknown>)['variant'] = 'sidebar';
    const navItems = children[0]?.['items'] as Array<Record<string, unknown>>;
    navItems[0]!['isActive'] = 'true';
    children[1]!['variant'] = 'h1';
    children[2]!['columns'] = 12;
    const grid = children[2]?.['children'] as Array<Record<string, unknown>>;
    grid[0]!['ratio'] = 'landscape';
    children[4]!['inputType'] = 'dropdown';
    children[5]!['variant'] = 'destructive';
    const result = validOf(doc);
    const screen = result.document.screens[0]!;
    expect(screen.viewport).toBe('mobile');
    expect(result.document.theme.font).toBe('mono');
    expect(result.document.theme.radius).toBe('full');
    const stack = screen.root;
    expect(stack.kind === 'stack' && stack.direction).toBe('column');
    expect(stack.kind === 'stack' && stack.align).toBe('start');
    expect(stack.kind === 'stack' && stack.justify).toBe('between');
    expect(stack.kind === 'stack' && stack.surface).toBe(false);
    const nodes = stack.kind === 'stack' ? stack.children : [];
    expect(nodes[0]?.kind === 'navigation' && nodes[0].variant).toBe('side');
    expect(nodes[0]?.kind === 'navigation' && nodes[0].items[0]?.isActive).toBe(false);
    expect(nodes[1]?.kind === 'text' && nodes[1].variant).toBe('title');
    expect(nodes[2]?.kind === 'grid' && nodes[2].columns).toBe(6);
    expect(nodes[4]?.kind === 'input' && nodes[4].inputType).toBe('select');
    expect(nodes[5]?.kind === 'button' && nodes[5].variant).toBe('danger');
  });

  it('reports one row per distinct fact, with a count and the first path', () => {
    const doc = validDocument();
    const children = (doc.screens[0]?.root as Record<string, unknown>)['children'] as Array<
      Record<string, unknown>
    >;
    for (let index = 0; index < 14; index += 1) {
      children.push({
        id: `card-${index}`,
        kind: 'stack',
        direction: 'column',
        gap: 'xl',
        width: 320,
        children: [],
      });
    }
    const result = validOf(doc);
    expect(result.adjustments).toHaveLength(2);
    const dropped = listedAt({ result, index: 0 });
    expect(dropped.change).toBe('dropped');
    expect(dropped.path).toBe('screens[0].root.children[7].width');
    expect(dropped.message).toContain('so it was dropped');
    expect(dropped.count).toBe(14);
    const moved = listedAt({ result, index: 1 });
    expect(moved.change).toBe('moved');
    expect(moved.path).toBe('screens[0].root.children[7].gap');
    expect(moved.message).toContain('so it was drawn as lg');
    expect(moved.count).toBe(14);
  });

  it('keeps two different drifts of the same field apart', () => {
    const doc = validDocument();
    const children = (doc.screens[0]?.root as Record<string, unknown>)['children'] as Array<
      Record<string, unknown>
    >;
    children.push({ id: 'wide-row', kind: 'stack', direction: 'column', gap: 'xl', children: [] });
    children.push({ id: 'tight-row', kind: 'stack', direction: 'column', gap: 'xs', children: [] });
    const result = validOf(doc);
    expect(result.adjustments).toHaveLength(2);
    expect(listedAt({ result, index: 0 }).count).toBe(1);
    expect(listedAt({ result, index: 1 }).count).toBe(1);
    expect(adjustmentsOf(result)).toContain('so it was drawn as lg');
    expect(adjustmentsOf(result)).toContain('so it was drawn as sm');
  });

  it('caps only on distinct facts and says which class it is hiding', () => {
    const doc = validDocument();
    const root = doc.screens[0]?.root as Record<string, unknown>;
    root['gap'] = 'xl';
    const children = root['children'] as Array<Record<string, unknown>>;
    for (let index = 0; index < MAX_WIREFRAME_ADJUSTMENTS + 3; index += 1) {
      children.push({
        id: `card-${index}`,
        kind: 'stack',
        direction: 'column',
        children: [],
        [`rogue${index}`]: 1,
      });
    }
    const result = validOf(doc);
    expect(result.adjustments).toHaveLength(MAX_WIREFRAME_ADJUSTMENTS + 1);
    const last = hiddenOf({ result });
    expect(last.moved).toBe(0);
    expect(last.dropped).toBe(4);
  });

  it('shortens a paragraph past the text limit and reports it instead of losing the document', () => {
    const paragraph = 'a'.repeat(900);
    const doc = validDocument();
    doc.screens[1] = {
      ...doc.screens[1],
      root: text({ id: 'detail-title', value: paragraph }),
    } as never;
    const result = validOf(doc);
    const root = result.document.screens[1]?.root;
    expect(root?.kind === 'text' && root.text.length).toBe(WIREFRAME_LIMITS.maxTextLength);
    expect(root?.kind === 'text' && root.text.endsWith('\u2026')).toBe(true);
    const clipped = listedAt({ result, index: 0 });
    expect(clipped.change).toBe('clipped');
    expect(clipped.path).toBe('screens[1].root.text');
    expect(clipped.message).toBe(
      `was longer than the ${WIREFRAME_LIMITS.maxTextLength} character limit, so it was shortened to fit`,
    );
  });

  it('cuts at a word boundary when one is near, and mid word when none is', () => {
    const prose = `${'word '.repeat(90)}tail`;
    const doc = validDocument();
    doc.screens[1] = {
      ...doc.screens[1],
      root: text({ id: 'detail-title', value: prose }),
    } as never;
    const root = validOf(doc).document.screens[1]?.root;
    const clipped = root?.kind === 'text' ? root.text : '';
    expect(clipped.length).toBeLessThanOrEqual(WIREFRAME_LIMITS.maxTextLength);
    expect(clipped.endsWith('word\u2026')).toBe(true);
    expect(prose.startsWith(clipped.slice(0, -1))).toBe(true);

    const unbroken = validDocument();
    unbroken.screens[1] = {
      ...unbroken.screens[1],
      root: text({ id: 'detail-title', value: 'a'.repeat(900) }),
    } as never;
    const solid = validOf(unbroken).document.screens[1]?.root;
    const solidText = solid?.kind === 'text' ? solid.text : '';
    expect(solidText).toBe(`${'a'.repeat(WIREFRAME_LIMITS.maxTextLength - 1)}\u2026`);
  });

  it('keeps markup fatal when it sits past the text limit', () => {
    const doc = validDocument();
    doc.screens[1] = {
      ...doc.screens[1],
      root: text({ id: 'detail-title', value: `${'a'.repeat(600)}<script>alert(1)</script>` }),
    } as never;
    expect(invalidOf(doc)).toContain('raw html is not allowed');
  });

  it('still rejects a collection past its limit', () => {
    const items = validDocument();
    items.screens[1] = {
      ...items.screens[1],
      root: {
        id: 'detail-list',
        kind: 'list',
        items: Array.from({ length: WIREFRAME_LIMITS.maxListItems + 1 }, (_unused, index) => ({
          id: `row-${index}`,
          title: 'A session',
        })),
      },
    } as never;
    expect(invalidOf(items)).toContain(`more than the ${WIREFRAME_LIMITS.maxListItems} item limit`);

    const columns = validDocument();
    columns.screens[1] = {
      ...columns.screens[1],
      root: {
        id: 'detail-table',
        kind: 'table',
        columns: Array.from(
          { length: WIREFRAME_LIMITS.maxTableColumns + 1 },
          (_unused, index) => `c${index}`,
        ),
        rows: [],
      },
    } as never;
    expect(invalidOf(columns)).toContain(
      `more than the ${WIREFRAME_LIMITS.maxTableColumns} column limit`,
    );
  });

  it('still rejects an id past its length limit', () => {
    const doc = validDocument();
    doc.screens[1] = {
      ...doc.screens[1],
      root: text({ id: `d${'x'.repeat(WIREFRAME_LIMITS.maxIdLength)}`, value: 'Detail' }),
    } as never;
    expect(invalidOf(doc)).toContain('expected an id of letters, digits, dashes or underscores');
  });

  it('reports nothing when the document already matches the contract', () => {
    expect(validOf(validDocument()).adjustments).toEqual([]);
  });

  it('defaults a missing theme to the generic name', () => {
    const doc = validDocument();
    delete (doc as Record<string, unknown>)['theme'];
    const result = validateWireframeDocument({ value: doc });
    expect(result.status === 'valid' && result.document.theme.name).toBe('generic');
  });
});

describe('parseWireframeSource', () => {
  it('parses a valid json source', () => {
    const result = parseWireframeSource({ source: JSON.stringify(validDocument()) });
    expect(result.status).toBe('valid');
  });

  it('reports invalid json instead of throwing', () => {
    const result = parseWireframeSource({ source: '{"screens":' });
    expect(result.status === 'invalid' && result.issues[0]?.message).toBe(
      'the source is not valid JSON',
    );
  });
});

describe('WIREFRAME_SCHEMA_BRIEF', () => {
  it('states every limit that is fatal, straight from the constants', () => {
    const stated = [
      `at most ${WIREFRAME_LIMITS.maxIdLength} letters, digits, dashes or underscores`,
      `at most ${WIREFRAME_LIMITS.maxSelectOptions} options`,
      `at most ${WIREFRAME_LIMITS.maxListItems} items`,
      `at most ${WIREFRAME_LIMITS.maxTableColumns} columns and ${WIREFRAME_LIMITS.maxTableRows} rows`,
      `at most ${WIREFRAME_LIMITS.maxTransitions} of them`,
      'every key follows the same id rule as a node id',
      `is at most ${WIREFRAME_LIMITS.maxTextLength} characters`,
    ];
    for (const line of stated) {
      expect(WIREFRAME_SCHEMA_BRIEF).toContain(line);
    }
  });

  it('never forbids the fields that are a number or a boolean', () => {
    expect(WIREFRAME_SCHEMA_BRIEF).not.toContain('never a number');
    expect(WIREFRAME_SCHEMA_BRIEF).toContain(
      `columns is an integer from 1 to ${WIREFRAME_LIMITS.maxGridColumns}`,
    );
    expect(WIREFRAME_SCHEMA_BRIEF).toContain('surface and isActive are true or false');
    expect(WIREFRAME_SCHEMA_BRIEF).toContain('every mockState flag is true or false');
  });

  it('accepts a document that takes the numeric and boolean fields literally', () => {
    const doc = validDocument();
    const root = doc.screens[0]?.root as Record<string, unknown>;
    root['surface'] = true;
    const children = root['children'] as Array<Record<string, unknown>>;
    children[2]!['columns'] = WIREFRAME_LIMITS.maxGridColumns;
    const navItems = children[0]?.['items'] as Array<Record<string, unknown>>;
    navItems[0]!['isActive'] = false;
    doc.mockState = { isDrawerOpen: true } as never;
    expect(validOf(doc).adjustments).toEqual([]);
  });

  it('embeds an example the validator accepts', () => {
    const marker = 'a valid example:\n';
    const start = WIREFRAME_SCHEMA_BRIEF.indexOf(marker) + marker.length;
    const result = parseWireframeSource({ source: WIREFRAME_SCHEMA_BRIEF.slice(start) });
    expect(result.status).toBe('valid');
  });
});
