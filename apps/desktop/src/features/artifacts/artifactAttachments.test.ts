import { describe, expect, it } from 'vitest';
import {
  artifactAttachmentsSection,
  attachmentsInventoryRow,
  type ArtifactAttachment,
} from './artifactAttachments';

const shot = (overrides: Partial<ArtifactAttachment> = {}): ArtifactAttachment => ({
  id: 'att-1',
  fileName: 'inbox.png',
  mimeType: 'image/png',
  relPath: '.goodboy/attachments/att-1-inbox.png',
  ...overrides,
});

describe('artifactAttachmentsSection', () => {
  it('lists every path and tells the agent to read it first', () => {
    const section = artifactAttachmentsSection({
      attachments: [
        shot(),
        shot({ id: 'att-2', fileName: 'detail.png', relPath: '.goodboy/attachments/att-2-d.png' }),
      ],
    });
    expect(section).toContain('## attachments');
    expect(section).toContain('read each path with your Read tool before relying on it');
    expect(section).toContain('- .goodboy/attachments/att-1-inbox.png');
    expect(section).toContain('- .goodboy/attachments/att-2-d.png');
  });

  it('writes no section when nothing is attached', () => {
    expect(artifactAttachmentsSection({ attachments: [] })).toBeNull();
  });
});

describe('attachmentsInventoryRow', () => {
  it('names what is attached so the disclosure can be read before generating', () => {
    const row = attachmentsInventoryRow({
      attachments: [shot(), shot({ id: 'att-2', fileName: 'detail.png' })],
    });
    expect(row.id).toBe('attachments');
    expect(row.state).toBe('included');
    expect(row.summary).toContain('2 files');
    expect(row.detail).toEqual(['inbox.png', 'detail.png']);
  });

  it('says nothing is attached rather than hiding the row', () => {
    const row = attachmentsInventoryRow({ attachments: [] });
    expect(row.state).toBe('missing');
    expect(row.summary).toBe('nothing attached');
  });
});
