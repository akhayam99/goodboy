import { describe, expect, it } from 'vitest';
import { WIREFRAME_LIMITS } from './schema';
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

  it('rejects unknown properties at every level', () => {
    const doc = validDocument();
    const rogue = { ...doc, onLoad: 'fetch()' };
    expect(invalidOf(rogue)).toContain('onLoad: unknown property');
    const nested = validDocument();
    nested.screens[1] = {
      ...nested.screens[1],
      root: { ...text({ id: 'detail-title', value: 'Detail' }), style: 'color:red' },
    } as never;
    expect(invalidOf(nested)).toContain('unknown property');
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

  it('rejects a theme color that is not a hex value', () => {
    const doc = validDocument();
    doc.theme = { name: 'brand', colors: { accent: 'var(--brand)' } } as never;
    expect(invalidOf(doc)).toContain('expected a hex color');
  });

  it('rejects a table row whose cell count does not match the columns', () => {
    const doc = validDocument();
    doc.screens[1] = {
      ...doc.screens[1],
      root: { id: 'detail-table', kind: 'table', columns: ['a', 'b'], rows: [['only one']] },
    } as never;
    expect(invalidOf(doc)).toContain('expected 2 cells');
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
  it('embeds an example the validator accepts', () => {
    const marker = 'a valid example:\n';
    const start = WIREFRAME_SCHEMA_BRIEF.indexOf(marker) + marker.length;
    const result = parseWireframeSource({ source: WIREFRAME_SCHEMA_BRIEF.slice(start) });
    expect(result.status).toBe('valid');
  });
});
