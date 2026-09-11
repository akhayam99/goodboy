import { describe, expect, it } from 'vitest';
import { lensDestinations } from './lens-destinations';
import { SHORTCUTS, type ShortcutId } from '../../shared/keyboard/registry';

const LENS_SHORTCUT_IDS = (Object.keys(SHORTCUTS) as ReadonlyArray<ShortcutId>).filter((id) =>
  id.startsWith('lens.'),
);

describe('lensDestinations', () => {
  it('offers every lens that has a chord, so the palette teaches what exists', () => {
    const offered = new Set(
      [
        ...lensDestinations({ isBranchless: false }),
        ...lensDestinations({ isBranchless: true }),
      ].map((destination) => destination.shortcut),
    );

    for (const id of LENS_SHORTCUT_IDS) {
      if (id === 'lens.back' || id === 'lens.forward') {
        continue;
      }
      expect(offered.has(id), `${id} has a chord but no palette destination`).toBe(true);
    }
  });

  it('never names a chord the registry does not bind', () => {
    for (const destination of lensDestinations({ isBranchless: false })) {
      expect(SHORTCUTS[destination.shortcut], destination.shortcut).toBeDefined();
    }
  });

  it('offers the diff to a branch session and file versions to a branchless one', () => {
    const branched = lensDestinations({ isBranchless: false }).map((d) => d.lens);
    const branchless = lensDestinations({ isBranchless: true }).map((d) => d.lens);

    expect(branched).toContain('files');
    expect(branched).not.toContain('explore');
    expect(branchless).toContain('explore');
    expect(branchless).not.toContain('files');
  });

  it('hides the code host and issue trackers from a branchless session', () => {
    const branchless = lensDestinations({ isBranchless: true }).map((d) => d.lens);

    expect(branchless).not.toContain('pr');
    expect(branchless).not.toContain('linear');
    expect(branchless).not.toContain('terminal');
    expect(branchless).toContain('plans');
  });

  it('always offers the overview', () => {
    expect(lensDestinations({ isBranchless: true })[0]?.lens).toBeNull();
  });
});
