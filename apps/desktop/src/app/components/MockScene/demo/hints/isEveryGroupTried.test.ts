import { describe, expect, it } from 'vitest';
import { DEMO_CHAPTERS, type DemoChapter } from '../demoChapters';
import { isEveryGroupTried } from './isEveryGroupTried';
import type { HintTally } from './hintTally';

type TallyParams = {
  readonly chapter: DemoChapter;
};

type AllParams = {
  readonly triedIds: ReadonlyArray<string>;
};

const tallies =
  ({ triedIds }: AllParams) =>
  ({ chapter }: TallyParams): HintTally => {
    const total = chapter.hints === undefined ? 0 : 1;
    return { tried: triedIds.includes(chapter.id) ? total : 0, total };
  };

const [first] = DEMO_CHAPTERS;
const withoutHints: DemoChapter = { ...first, id: 'quiet', hints: undefined };
const chapters: ReadonlyArray<DemoChapter> = [first, withoutHints];

describe('every group tried', () => {
  it('gives every group of the playground hints of its own', () => {
    expect(DEMO_CHAPTERS.filter((chapter) => (chapter.hints ?? []).length === 0)).toEqual([]);
  });

  it('waits for a group without hints until it is visited', () => {
    expect(
      isEveryGroupTried({
        chapters,
        tallyOf: tallies({ triedIds: [first.id] }),
        visitedIds: [first.id],
      }),
    ).toBe(false);
    expect(
      isEveryGroupTried({
        chapters,
        tallyOf: tallies({ triedIds: [first.id] }),
        visitedIds: [first.id, 'quiet'],
      }),
    ).toBe(true);
  });

  it('counts a visit alone as nothing for a group that has hints', () => {
    expect(
      isEveryGroupTried({
        chapters,
        tallyOf: tallies({ triedIds: [] }),
        visitedIds: [first.id, 'quiet'],
      }),
    ).toBe(false);
  });

  it('includes every playground group in the check', () => {
    const everyId = DEMO_CHAPTERS.map((chapter) => chapter.id);
    const allButLast = everyId.slice(0, -1);
    expect(
      isEveryGroupTried({
        chapters: DEMO_CHAPTERS,
        tallyOf: tallies({ triedIds: allButLast }),
        visitedIds: everyId,
      }),
    ).toBe(false);
    expect(
      isEveryGroupTried({
        chapters: DEMO_CHAPTERS,
        tallyOf: tallies({ triedIds: everyId }),
        visitedIds: [],
      }),
    ).toBe(true);
  });
});
