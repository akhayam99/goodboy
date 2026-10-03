import { describe, expect, it } from 'vitest';
import {
  dataUrlToBase64,
  extFromMime,
  fromStoredAttachment,
  storedToAttachmentInput,
  toAttachmentInputs,
  toStoredAttachment,
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
  it('reads the kept file into provider input only when the message is sent', async () => {
    const pending: PendingAttachment = {
      id: 'att_1',
      fileName: 'shot.png',
      mimeType: 'image/png',
      blob: new Blob(['ABC'], { type: 'image/png' }),
      relPath: null,
    };
    expect(await toAttachmentInputs([pending])).toEqual([
      {
        id: 'att_1',
        fileName: 'shot.png',
        mimeType: 'image/png',
        dataBase64: 'QUJD',
      },
    ]);
  });
});

describe('stored attachments', () => {
  it('round-trips a queued attachment through its stored data url', async () => {
    const pending: PendingAttachment = {
      id: 'att_2',
      fileName: 'trace.png',
      mimeType: 'image/png',
      blob: new Blob(['ABC'], { type: 'image/png' }),
      relPath: '.goodboy/attachments/att_2-trace.png',
    };
    const stored = await toStoredAttachment(pending);
    expect(stored.dataUrl).toBe('data:image/png;base64,QUJD');
    const back = fromStoredAttachment(stored);
    expect(back.relPath).toBe(pending.relPath);
    expect(await back.blob.text()).toBe('ABC');
    expect(storedToAttachmentInput(stored).dataBase64).toBe('QUJD');
  });
});
