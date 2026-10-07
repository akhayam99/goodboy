// @vitest-environment node
import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = join(__dirname, '..', '..', '..', '..', '..');

const sourceOf = ({ path }: { readonly path: string }): string =>
  readFileSync(join(REPO_ROOT, path), 'utf8');

const CARD = 'apps/desktop/src/features/workspace/components/StageBoard/StageBoardCard/index.tsx';
const PR_SLOT =
  'apps/desktop/src/features/workspace/components/StageBoard/StageBoardCard/PrRequestSlot.tsx';
const OPTION_ROW = 'apps/desktop/src/shared/components/AnswerOptionRow/index.tsx';

describe('a Board card says its state once', () => {
  it('never tints its quick action, the tone line is the one signal', () => {
    expect(sourceOf({ path: CARD })).not.toMatch(/highlighted=/);
  });

  it('shows the pointer on its title button, as it does on the card', () => {
    const source = sourceOf({ path: CARD });

    expect(source).toMatch(/min-w-0 flex-1 cursor-pointer rounded-sm text-left/);
    expect(source).toMatch(/shrink-0 cursor-pointer grid-cols/);
  });

  it('keeps the age and the cost in one grid cell, so the hover swap moves nothing', () => {
    const source = sourceOf({ path: CARD });

    expect(source.match(/col-start-1 row-start-1/g)).toHaveLength(2);
    expect(source).toMatch(/invisible col-start-1 row-start-1/);
    expect(source).toMatch(/group-hover\/session-card:visible/);
    expect(source).toMatch(/group-hover\/session-card:invisible/);
  });

  it('draws a closed pull request glyph in the quiet foreground, never red beside the line', () => {
    expect(sourceOf({ path: PR_SLOT })).toMatch(
      /state === 'closed' \? 'text-muted-foreground' : undefined/,
    );
  });
});

describe('an answer option number', () => {
  it('reads in the muted foreground, the faint one is under 4.5:1 at 11px', () => {
    const source = sourceOf({ path: OPTION_ROW });

    expect(source).toMatch(/'bg-fill text-muted-foreground'/);
    expect(source).not.toMatch(/bg-fill text-faint-foreground/);
  });
});
