// @vitest-environment node
import { describe, expect, it } from 'vitest';
import * as ui from '@goodboy/ui';
import { productSources } from './scanControls';

const WEIGHT_BY_STATE =
  /\b(?:is|has)(?:Unread|New|Active|Current|Selected|Lit)\b[^;'"`{}]*?(?:\?|&&)\s*['"`][^'"`]*(?<![\w-])(?:font-(?:medium|semibold|bold)|text-row-strong)(?![\w-])/g;

type Hit = {
  readonly path: string;
  readonly line: number;
};

const weightHits = (): ReadonlyArray<Hit> =>
  productSources().flatMap(({ path, text }) =>
    [...text.matchAll(WEIGHT_BY_STATE)].map((match) => ({
      path,
      line: text.slice(0, match.index).split('\n').length,
    })),
  );

describe('a row title keeps one weight whatever its state', () => {
  it('never weighs a title by unread, new, active, current or selected', () => {
    expect(weightHits()).toEqual([]);
  });

  it('has no unread title role left to reach for', () => {
    expect(Object.keys(ui)).not.toContain('UNREAD_TITLE');
  });

  it('catches the shapes it guards against', () => {
    const shapes = [
      "isActive && 'font-medium text-foreground'",
      "isUnread ? 'font-medium text-foreground' : 'text-muted-foreground'",
      "item.rowState.phase === 'running' || item.hasUnread\n  ? 'text-row-strong'\n  : 'text-ui'",
    ];
    for (const shape of shapes) {
      expect(shape.match(WEIGHT_BY_STATE), shape).not.toBeNull();
    }
    expect("isUnread ? 'text-foreground' : 'text-muted-foreground'".match(WEIGHT_BY_STATE)).toBe(
      null,
    );
  });
});
