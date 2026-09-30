import { describe, expect, it } from 'vitest';
import {
  dataUrlToBase64,
  extFromMime,
  readFileAsDataUrl,
  toAttachmentInput,
  type PendingAttachment,
} from './pendingAttachment';

describe('extFromMime', () => {
  it('extracts the subtype as the extension', () => {
    expect(extFromMime('image/png')).toBe('png');
    expect(extFromMime('image/jpeg')).toBe('jpeg');
  });

  it('falls back to "png" when there is no subtype', () => {
    expect(extFromMime('image/')).toBe('png');
  });

  it('falls back to "png" when there is no slash', () => {
    expect(extFromMime('png')).toBe('png');
  });

  it('falls back to "png" for an over-long subtype', () => {
    expect(extFromMime('application/octet-stream')).toBe('png');
  });
});

describe('dataUrlToBase64', () => {
  it('strips the data url header', () => {
    expect(dataUrlToBase64('data:image/png;base64,AAAB')).toBe('AAAB');
  });

  it('returns the input when there is no comma', () => {
    expect(dataUrlToBase64('AAAB')).toBe('AAAB');
  });
});

describe('toAttachmentInput', () => {
  it('maps a pending attachment to provider input with decoded base64', () => {
    const pending: PendingAttachment = {
      id: 'att_1',
      fileName: 'shot.png',
      mimeType: 'image/png',
      dataUrl: 'data:image/png;base64,AAAB',
      relPath: null,
    };
    expect(toAttachmentInput(pending)).toEqual({
      id: 'att_1',
      fileName: 'shot.png',
      mimeType: 'image/png',
      dataBase64: 'AAAB',
    });
  });
});

describe('readFileAsDataUrl', () => {
  it('reads a file into a data url string', async () => {
    const file = new File(['hello'], 'hello.txt', { type: 'text/plain' });
    const result = await readFileAsDataUrl(file);
    expect(result.startsWith('data:')).toBe(true);
  });
});
