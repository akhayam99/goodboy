// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  IS_UPDATING,
  grownEntries,
  nonZero,
  openingTags,
  productSources,
  readBaseline,
  writeBaseline,
  type FileCounts,
  type SourceFile,
} from './scanControls';

const BASELINE_FILE = 'inline-confirm-placement.baseline.json';
const CONFIRM_POPOVER_PATH = 'packages/ui/src/components/ConfirmPopover.tsx';
const CONFIRM_TAG_NAME = '[A-Za-z]*Confirm';
const CONFIRM_IMPORT = /import\s+(?:type\s+)?\{[^}]*\b[A-Za-z]*Confirm\b[^}]*\}\s+from/;
const CONFIRM_DEFINITION = /export const ([A-Za-z]*Confirm) =/g;
const FLOATING_BELOW = /\babsolute\b[^'"`]*\btop-full\b/;
const INLINE_CONFIRM = 'InlineConfirm';
const FLOATING_ALLOWED: Readonly<Record<string, string>> = {
  'apps/desktop/src/features/workspace-chat/components/ChatRoom/ChatHeaderDelete.tsx':
    'floats the chat delete card under its trigger until the confirm sweep moves it to a ConfirmPopover',
};

type CardParams = {
  readonly text: string;
  readonly wrappers: ReadonlySet<string>;
};

type PlacementParams = CardParams & {
  readonly path: string;
};

const tagName = ({ tag }: { readonly tag: string }): string => /^<([A-Za-z]+)/.exec(tag)?.[1] ?? '';

const cardTags = ({ text, wrappers }: CardParams): ReadonlyArray<string> =>
  openingTags({ text, name: CONFIRM_TAG_NAME }).filter((tag) => {
    const name = tagName({ tag });
    if (name === INLINE_CONFIRM) {
      return !tag.includes('surface="plain"');
    }
    return wrappers.has(name);
  });

const cardWrappers = ({ sources }: { readonly sources: ReadonlyArray<SourceFile> }) =>
  new Set(
    sources.flatMap(({ text }) =>
      cardTags({ text, wrappers: new Set() }).length === 0
        ? []
        : [...text.matchAll(CONFIRM_DEFINITION)].map((match) => match[1] ?? ''),
    ),
  );

const usesConfirm = ({ text }: { readonly text: string }): boolean =>
  CONFIRM_IMPORT.test(text) || openingTags({ text, name: INLINE_CONFIRM }).length > 0;

const placementProblem = ({ path, text, wrappers }: PlacementParams): string | null => {
  if (!usesConfirm({ text })) {
    return null;
  }
  if (FLOATING_BELOW.test(text) && FLOATING_ALLOWED[path] === undefined) {
    return 'floats a confirm with absolute top-full; use ConfirmPopover';
  }
  if (!text.includes('<AnchoredPopover') && !text.includes('<Popover')) {
    return null;
  }
  if (cardTags({ text, wrappers }).length === 0) {
    return null;
  }
  return 'nests a card confirm in a popover; use ConfirmPopover or a plain menu swap';
};

const measure = ({ sources }: { readonly sources: ReadonlyArray<SourceFile> }): FileCounts => {
  const wrappers = cardWrappers({ sources });
  return nonZero({
    counts: Object.fromEntries(
      sources
        .filter(({ path, text }) => path !== CONFIRM_POPOVER_PATH && usesConfirm({ text }))
        .map(({ path, text }) => [path, cardTags({ text, wrappers }).length]),
    ),
  });
};

const NO_WRAPPERS: ReadonlySet<string> = new Set();

describe('confirm placement', () => {
  it('counts a card InlineConfirm and leaves a plain one and a popover alone', () => {
    const text = [
      `import { InlineConfirm } from '@goodboy/ui';`,
      '<InlineConfirm role="danger" title="Delete?" />',
      '<InlineConfirm role="danger" title="Reset?" surface="plain" />',
      '<ConfirmPopover role="danger" title="Remove?" />',
    ].join('\n');

    expect(cardTags({ text, wrappers: NO_WRAPPERS })).toHaveLength(1);
  });

  it('counts a wrapper whose own file draws the card', () => {
    const sources: ReadonlyArray<SourceFile> = [
      {
        path: 'apps/desktop/src/features/x/DeleteThingConfirm.tsx',
        text: `export const DeleteThingConfirm = () => <InlineConfirm role="danger" title="Delete?" />;`,
      },
      {
        path: 'apps/desktop/src/features/x/Row.tsx',
        text: `import { DeleteThingConfirm } from './DeleteThingConfirm';\n<DeleteThingConfirm />`,
      },
    ];

    expect(measure({ sources })).toEqual({
      'apps/desktop/src/features/x/DeleteThingConfirm.tsx': 1,
      'apps/desktop/src/features/x/Row.tsx': 1,
    });
  });

  it('fails a new card confirm in a file beyond its baseline', () => {
    const sources: ReadonlyArray<SourceFile> = [
      {
        path: 'apps/desktop/src/features/x/Row.tsx',
        text: [
          `import { InlineConfirm } from '@goodboy/ui';`,
          '<InlineConfirm role="danger" title="Delete?" />',
          '<InlineConfirm role="danger" title="Archive?" />',
        ].join('\n'),
      },
    ];
    const baseline: FileCounts = { 'apps/desktop/src/features/x/Row.tsx': 1 };

    expect(grownEntries({ current: measure({ sources }), baseline })).toEqual([
      '  - apps/desktop/src/features/x/Row.tsx: 2 (baseline 1)',
    ]);
    expect(grownEntries({ current: measure({ sources }), baseline: {} })).toHaveLength(1);
  });

  it('bans absolute top-full next to a confirm', () => {
    const text = [
      `import { InlineConfirm } from '@goodboy/ui';`,
      '<div className="absolute top-full right-0">',
      '<InlineConfirm role="danger" title="Delete?" surface="plain" />',
      '</div>',
    ].join('\n');

    expect(placementProblem({ path: 'fixture.tsx', text, wrappers: NO_WRAPPERS })).toBe(
      'floats a confirm with absolute top-full; use ConfirmPopover',
    );
  });

  it('bans a card confirm nested in a popover', () => {
    const text = [
      `import { InlineConfirm } from '@goodboy/ui';`,
      '<AnchoredPopover>',
      '<InlineConfirm role="danger" title="Delete?" />',
      '</AnchoredPopover>',
    ].join('\n');

    expect(placementProblem({ path: 'fixture.tsx', text, wrappers: NO_WRAPPERS })).toBe(
      'nests a card confirm in a popover; use ConfirmPopover or a plain menu swap',
    );
  });

  it('keeps the floating allowance only for files that still float a confirm', () => {
    const sources = productSources();
    const stale = Object.keys(FLOATING_ALLOWED).filter(
      (path) => !sources.some((file) => file.path === path && FLOATING_BELOW.test(file.text)),
    );

    expect(stale).toEqual([]);
  });

  it('puts no confirm in a floating layer beside its trigger', () => {
    const sources = productSources();
    const wrappers = cardWrappers({ sources });
    const offenders = sources
      .filter(({ path }) => path !== CONFIRM_POPOVER_PATH)
      .flatMap(({ path, text }) => {
        const problem = placementProblem({ path, text, wrappers });
        return problem === null ? [] : [`${path}: ${problem}`];
      });

    expect(offenders, offenders.join('\n')).toEqual([]);
  });

  it('adds no card confirm beyond the baseline: use ConfirmPopover, or Undo when restorable', () => {
    const current = measure({ sources: productSources() });
    if (IS_UPDATING) {
      writeBaseline({ file: BASELINE_FILE, counts: current });
      return;
    }
    const grown = grownEntries({ current, baseline: readBaseline({ file: BASELINE_FILE }) });

    expect(
      grown,
      `A confirm anchors to its trigger in a ConfirmPopover, and anything restorable acts at once with Undo. The baseline only falls.\n${grown.join('\n')}`,
    ).toEqual([]);
  });
});
