// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { brandId, type WorkspaceId } from '@goodboy/types';
import { attentionByWorkspaceOf } from './attentionByWorkspaceOf';
import { attentionElsewhereOf } from './attentionElsewhereOf';
import type { WorkspaceAttentionEntry } from './state';

const HARBORLINE = brandId<WorkspaceId>({ value: 'ws-harborline' });
const NORTHWIND = brandId<WorkspaceId>({ value: 'ws-northwind' });
const CASCADIA = brandId<WorkspaceId>({ value: 'ws-cascadia' });

const entryOf = (
  count: number,
  tone: WorkspaceAttentionEntry['tone'] = 'warning',
): WorkspaceAttentionEntry => ({ count, tone, reasonWords: [] });

describe('attentionByWorkspaceOf', () => {
  it('takes the report of a window for a workspace a window shows', () => {
    const merged = attentionByWorkspaceOf({
      fromDatabase: { [NORTHWIND]: entryOf(2) },
      fromWindows: { [NORTHWIND]: entryOf(5) },
      shownIds: new Set([NORTHWIND]),
    });

    expect(merged[NORTHWIND]?.count).toBe(5);
  });

  it('takes the database for a workspace no window shows, whatever an old report said', () => {
    const merged = attentionByWorkspaceOf({
      fromDatabase: { [NORTHWIND]: entryOf(2) },
      fromWindows: { [NORTHWIND]: entryOf(5) },
      shownIds: new Set(),
    });

    expect(merged[NORTHWIND]?.count).toBe(2);
  });

  it('lets a window report of zero hide a database count that is behind', () => {
    const merged = attentionByWorkspaceOf({
      fromDatabase: { [NORTHWIND]: entryOf(2) },
      fromWindows: { [NORTHWIND]: entryOf(0) },
      shownIds: new Set([NORTHWIND]),
    });

    expect(merged).toEqual({});
  });

  it('keeps a window report for a workspace the database does not know', () => {
    const merged = attentionByWorkspaceOf({
      fromDatabase: {},
      fromWindows: { [CASCADIA]: entryOf(1, 'danger') },
      shownIds: new Set([CASCADIA]),
    });

    expect(merged[CASCADIA]?.tone).toBe('danger');
  });
});

describe('attentionElsewhereOf', () => {
  it('adds every workspace but the current one', () => {
    expect(
      attentionElsewhereOf({
        byWorkspace: { [HARBORLINE]: entryOf(4), [NORTHWIND]: entryOf(2), [CASCADIA]: entryOf(1) },
        currentId: HARBORLINE,
      }),
    ).toEqual({ count: 3, tone: 'warning' });
  });

  it('turns red when one of the others is broken', () => {
    expect(
      attentionElsewhereOf({
        byWorkspace: { [NORTHWIND]: entryOf(2), [CASCADIA]: entryOf(1, 'danger') },
        currentId: null,
      }).tone,
    ).toBe('danger');
  });

  it('has no tone when nothing waits elsewhere', () => {
    expect(
      attentionElsewhereOf({ byWorkspace: { [HARBORLINE]: entryOf(4) }, currentId: HARBORLINE }),
    ).toEqual({ count: 0, tone: null });
  });
});
