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
const FLOATING_BELOW = /\babsolute\b[^'"`]*\btop-full\b/;
const FLOATING_ALLOWED: Readonly<Record<string, string>> = {};
const CARD_ATTRIBUTES = /\b(?:surface|autoDisarmMs)=/;

type CardParams = {
  readonly text: string;
};

type PlacementParams = CardParams & {
  readonly path: string;
};

const cardTags = ({ text }: CardParams): ReadonlyArray<string> =>
  openingTags({ text, name: CONFIRM_TAG_NAME }).filter((tag) => CARD_ATTRIBUTES.test(tag));

const usesConfirm = ({ text }: { readonly text: string }): boolean => CONFIRM_IMPORT.test(text);

const placementProblem = ({ path, text }: PlacementParams): string | null => {
  if (!usesConfirm({ text })) {
    return null;
  }
  if (FLOATING_BELOW.test(text) && FLOATING_ALLOWED[path] === undefined) {
    return 'floats a confirm with absolute top-full; use ConfirmPopover';
  }
  return null;
};

const measure = ({ sources }: { readonly sources: ReadonlyArray<SourceFile> }): FileCounts =>
  nonZero({
    counts: Object.fromEntries(
      sources
        .filter(({ path, text }) => path !== CONFIRM_POPOVER_PATH && usesConfirm({ text }))
        .map(({ path, text }) => [path, cardTags({ text }).length]),
    ),
  });

describe('confirm placement', () => {
  it('counts a confirm that asks for a card surface or an auto-disarm delay', () => {
    const text = [
      `import { InlineConfirm } from '@goodboy/ui';`,
      '<InlineConfirm role="danger" title="Delete?" surface="card" />',
      '<InlineConfirm role="danger" title="Skip?" autoDisarmMs={4000} />',
      '<InlineConfirm role="danger" title="Reset?" />',
      '<ConfirmPopover role="danger" title="Remove?" />',
    ].join('\n');

    expect(cardTags({ text })).toHaveLength(2);
  });

  it('fails a card confirm with no allowance', () => {
    const sources: ReadonlyArray<SourceFile> = [
      {
        path: 'apps/desktop/src/features/x/Row.tsx',
        text: [
          `import { InlineConfirm } from '@goodboy/ui';`,
          '<InlineConfirm role="danger" title="Delete?" surface="card" />',
        ].join('\n'),
      },
    ];

    expect(grownEntries({ current: measure({ sources }), baseline: {} })).toEqual([
      '  - apps/desktop/src/features/x/Row.tsx: 1 (baseline 0)',
    ]);
  });

  it('bans absolute top-full next to a confirm', () => {
    const text = [
      `import { InlineConfirm } from '@goodboy/ui';`,
      '<div className="absolute top-full right-0">',
      '<InlineConfirm role="danger" title="Delete?" />',
      '</div>',
    ].join('\n');

    expect(placementProblem({ path: 'fixture.tsx', text })).toBe(
      'floats a confirm with absolute top-full; use ConfirmPopover',
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
    const offenders = productSources()
      .filter(({ path }) => path !== CONFIRM_POPOVER_PATH)
      .flatMap(({ path, text }) => {
        const problem = placementProblem({ path, text });
        return problem === null ? [] : [`${path}: ${problem}`];
      });

    expect(offenders, offenders.join('\n')).toEqual([]);
  });

  it('keeps an empty baseline: a confirm is a ConfirmPopover, or acts at once with Undo', () => {
    const current = measure({ sources: productSources() });
    if (IS_UPDATING) {
      writeBaseline({ file: BASELINE_FILE, counts: current });
      return;
    }
    const baseline = readBaseline({ file: BASELINE_FILE });
    const grown = grownEntries({ current, baseline });

    expect(baseline).toEqual({});
    expect(
      grown,
      `There is no card confirm any more: ask in a ConfirmPopover beside the trigger, or act at once with Undo.\n${grown.join('\n')}`,
    ).toEqual([]);
  });
});
