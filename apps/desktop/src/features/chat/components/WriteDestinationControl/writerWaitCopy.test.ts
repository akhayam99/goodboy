// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { WriterWaitView } from './useWriterWait';
import { writerWaitCopy } from './writerWaitCopy';

describe('writerWaitCopy', () => {
  it('names the folder, the session writing there and when this turn starts', () => {
    expect(
      writerWaitCopy({
        view: {
          folderName: 'acme-notes',
          writer: { kind: 'session', sessionTitle: 'Tighten the launch memo' },
          minutes: 2,
        },
      }),
    ).toEqual({
      title: 'Waiting to write in acme-notes.',
      body: 'Tighten the launch memo is writing there now. One session writes in a folder at a time. This turn starts by itself when it finishes, in about 2 minutes. Until then, agents here can read and answer.',
    });
  });

  it('says one minute, and leaves the time out when there is no estimate', () => {
    const view: Omit<WriterWaitView, 'minutes'> = {
      folderName: 'acme-notes',
      writer: { kind: 'session', sessionTitle: 'Draft the FAQ' },
    };

    expect(writerWaitCopy({ view: { ...view, minutes: 1 } }).body).toContain(
      'when it finishes, in about 1 minute.',
    );
    expect(writerWaitCopy({ view: { ...view, minutes: null } }).body).toContain(
      'This turn starts by itself when it finishes. Until then',
    );
  });

  it('names a writer in the same session, and one it cannot see', () => {
    expect(
      writerWaitCopy({
        view: { folderName: 'acme-notes', writer: { kind: 'this-session' }, minutes: null },
      }).body.startsWith('Another agent in this session is writing there now'),
    ).toBe(true);
    expect(
      writerWaitCopy({
        view: { folderName: 'acme-notes', writer: { kind: 'unknown' }, minutes: null },
      }).body.startsWith('Another session is writing there now'),
    ).toBe(true);
  });

  it('keeps the plain writer line for a folder that is not a plain folder project', () => {
    expect(
      writerWaitCopy({ view: { folderName: null, writer: { kind: 'unknown' }, minutes: null } }),
    ).toEqual({
      title: 'Waiting for the writer.',
      body: 'Another agent is writing in this folder. This turn starts by itself when it finishes. Until then, agents here can read and answer.',
    });
  });
});
