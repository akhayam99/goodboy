import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MessageAttachment } from '@goodboy/types';

const h = vi.hoisted(() => ({
  readAttachment: vi.fn(),
}));

vi.mock('../../turn', () => ({ readAttachment: h.readAttachment }));

const { missingAttachmentsMessage, readRetryAttachments } = await import('./readRetryAttachments');

const attachment = ({ id, fileName }: { readonly id: string; readonly fileName: string }) =>
  ({
    id,
    kind: 'file',
    fileName,
    mimeType: 'text/plain',
    relPath: `.goodboy/attachments/${fileName}`,
  }) satisfies MessageAttachment;

describe('readRetryAttachments', () => {
  beforeEach(() => {
    h.readAttachment.mockReset();
  });

  it('keeps the files it can read and names the ones it cannot', async () => {
    h.readAttachment.mockImplementation(async (_root: string, relPath: string) => {
      if (relPath.endsWith('gone.md')) {
        throw new Error('not found');
      }
      return 'data:text/plain;base64,aGVsbG8=';
    });

    const result = await readRetryAttachments({
      worktreePath: '/repos/ledger-core',
      attachments: [
        attachment({ id: 'a', fileName: 'notes.md' }),
        attachment({ id: 'b', fileName: 'gone.md' }),
      ],
    });

    expect(result.inputs).toEqual([
      { id: 'a', fileName: 'notes.md', mimeType: 'text/plain', dataBase64: 'aGVsbG8=' },
    ]);
    expect(result.missing).toEqual(['gone.md']);
  });

  it('reports every file missing when the session has no worktree', async () => {
    const result = await readRetryAttachments({
      worktreePath: null,
      attachments: [attachment({ id: 'a', fileName: 'notes.md' })],
    });

    expect(result).toEqual({ inputs: [], missing: ['notes.md'] });
    expect(h.readAttachment).not.toHaveBeenCalled();
  });

  it('names the missing files in the warning', () => {
    expect(missingAttachmentsMessage({ missing: ['gone.md'] })).toBe(
      'Retried without gone.md. The file is no longer readable.',
    );
    expect(missingAttachmentsMessage({ missing: ['a.md', 'b.png'] })).toBe(
      'Retried without a.md, b.png. The files are no longer readable.',
    );
  });
});
