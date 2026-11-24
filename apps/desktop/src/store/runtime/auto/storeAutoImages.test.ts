// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { brandId, type SessionId } from '@goodboy/types';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('../../../features/chat/turn', async () =>
  (await import('../../storyHarness')).turnModuleMock(),
);
vi.mock('../../../features/worktree/worktree', async () =>
  (await import('../../storyHarness')).worktreeModuleMock(),
);

import { storySpies } from '../../storyHarness';
import { storeAutoImages } from './storeAutoImages';

const SESSION = brandId<SessionId>({ value: 'session-harborline' });

describe('storeAutoImages', () => {
  it('keeps a pdf as a file and an image as an image, both in the scratch folder', async () => {
    storySpies.scratchDirPrepare.mockResolvedValueOnce('/scratch/session-harborline');
    storySpies.writeAttachment
      .mockResolvedValueOnce('.goodboy/attachments/brief/harborline-brief.pdf')
      .mockResolvedValueOnce('.goodboy/attachments/banner/banner-wide.png');

    const stored = await storeAutoImages({
      sessionId: SESSION,
      images: [
        {
          id: 'brief',
          fileName: 'harborline-brief.pdf',
          mimeType: 'application/pdf',
          dataBase64: 'JVBERi0xLjQK',
        },
        { id: 'banner', fileName: 'banner-wide.png', mimeType: 'image/png', dataBase64: 'iVBO' },
      ],
    });

    expect(stored).toEqual([
      {
        id: 'brief',
        kind: 'file',
        fileName: 'harborline-brief.pdf',
        mimeType: 'application/pdf',
        relPath: '.goodboy/attachments/brief/harborline-brief.pdf',
        dir: '/scratch/session-harborline',
      },
      {
        id: 'banner',
        kind: 'image',
        fileName: 'banner-wide.png',
        mimeType: 'image/png',
        relPath: '.goodboy/attachments/banner/banner-wide.png',
        dir: '/scratch/session-harborline',
      },
    ]);
  });
});
