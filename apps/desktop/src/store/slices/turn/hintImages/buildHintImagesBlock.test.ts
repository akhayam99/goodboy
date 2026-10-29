// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { GoalAttachment, OrchestratorHint } from '@goodboy/types';
import { isoDateTimeOf } from '../../../../__tests__/helpers/brandedIds';
import { buildHintImagesBlock } from './buildHintImagesBlock';

const AT = isoDateTimeOf({ value: '2026-10-29T10:00:00.000Z' });

const attachment = (id: string, kind: 'image' | 'file' = 'image'): GoalAttachment => ({
  id,
  ownerType: 'workflow_run',
  ownerId: 'run-1',
  relPath: `.goodboy/attachments/${id}/${id}.png`,
  kind,
  fileName: `${id}.png`,
  mimeType: kind === 'image' ? 'image/png' : 'text/plain',
  createdAt: AT,
});

const hint = (over: Partial<OrchestratorHint>): OrchestratorHint => ({
  id: 'hint',
  text: 'remove this header\nit sits above the ledger table',
  createdAt: AT,
  consumedAt: AT,
  consumedAtStep: 2,
  ...over,
});

const WORKTREE = '/work/harborline-ledger-core';

describe('buildHintImagesBlock', () => {
  it('lists exactly the two images of the hint the step launched under, under its first line', () => {
    const block = buildHintImagesBlock({
      hints: [hint({ attachmentIds: ['a', 'b'] })],
      attachments: [
        attachment('a'),
        attachment('b'),
        attachment('other'),
        attachment('doc', 'file'),
      ],
      worktreeDir: WORKTREE,
      stepNumber: 2,
    });
    expect(block.text).toContain("Images from the user's hint: remove this header");
    expect(block.text).not.toContain('ledger table');
    const paths = block.text.split('\n').filter((line) => line.startsWith('- '));
    expect(paths).toEqual([
      `- ${WORKTREE}/.goodboy/attachments/a/a.png`,
      `- ${WORKTREE}/.goodboy/attachments/b/b.png`,
    ]);
    expect([...block.attachmentIds]).toEqual(['a', 'b']);
  });

  it('ignores hints consumed by another step and hints without images', () => {
    const block = buildHintImagesBlock({
      hints: [
        hint({ id: 'early', consumedAtStep: 1, attachmentIds: ['a'] }),
        hint({ id: 'plain', text: 'keep it to one PR' }),
      ],
      attachments: [attachment('a')],
      worktreeDir: WORKTREE,
      stepNumber: 2,
    });
    expect(block.text).toBe('');
    expect(block.attachmentIds.size).toBe(0);
  });

  it('has nothing to point at without a worktree', () => {
    const block = buildHintImagesBlock({
      hints: [hint({ attachmentIds: ['a'] })],
      attachments: [attachment('a')],
      worktreeDir: null,
      stepNumber: 2,
    });
    expect(block.text).toBe('');
  });
});
