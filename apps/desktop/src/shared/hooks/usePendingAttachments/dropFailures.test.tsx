// @vitest-environment happy-dom

type DragHandler = (event: { readonly payload: unknown }) => void;

const { dragHandlers } = vi.hoisted(() => ({ dragHandlers: new Set<DragHandler>() }));

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/webview', () => ({
  getCurrentWebview: () => ({
    onDragDropEvent: async (handler: DragHandler) => {
      dragHandlers.add(handler);
      return () => dragHandlers.delete(handler);
    },
  }),
}));

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { storySpies, stubStoryInvoke } from '../../../store/storyHarness';
import type { ShowToast } from '../../components/Toast';
import { usePendingAttachments } from '.';
import { usePromptFiles } from '../usePromptFiles';

type Rejection = {
  readonly kind: string;
  readonly message: string;
};

type Outcome = { readonly dataBase64: string } | { readonly rejection: Rejection };

type ReadArgs = {
  readonly absPath: string;
};

const DESKTOP = '/Users/harborline/Desktop';
const TEMPORARY = '/private/var/folders/northwind/T/TemporaryItems';
const SHOT = 'Screenshot ledger-core.png';

const refused = ({ kind, message }: Rejection): Outcome => ({ rejection: { kind, message } });

const GONE = refused({ kind: 'gone', message: 'the dropped file was moved or deleted' });
const DENIED = refused({ kind: 'denied', message: 'no permission to read the dropped file' });
const UNSUPPORTED = refused({ kind: 'unsupported_mime', message: 'unsupported attachment type' });
const FOLDER = refused({ kind: 'invalid_path', message: 'not a file' });
const NOT_DROPPED = refused({ kind: 'not_dropped', message: 'path was not dropped' });
const TOO_LARGE = refused({ kind: 'too_large', message: 'attachment exceeds the limit' });
const READABLE: Outcome = { dataBase64: 'aGk=' };

const outcomes = new Map<string, Outcome>();

const readDropped = async ({ absPath }: ReadArgs): Promise<unknown> => {
  const outcome = outcomes.get(absPath);
  if (outcome === undefined) {
    throw new Error(`no outcome for ${absPath}`);
  }
  if ('rejection' in outcome) {
    return Promise.reject(outcome.rejection);
  }
  return {
    fileName: absPath.split('/').pop() ?? absPath,
    mimeType: 'image/png',
    dataBase64: outcome.dataBase64,
  };
};

const mountComposer = async ({ showToast }: { readonly showToast: Mock<ShowToast> }) => {
  const rendered = renderHook(() => usePendingAttachments({ showToast }));
  const element = document.createElement('div');
  element.setAttribute('data-drop-composer', '');
  document.body.appendChild(element);
  Object.defineProperty(element, 'offsetParent', { value: document.body, configurable: true });
  await act(async () => {
    rendered.result.current.composerRef.current = element;
  });
  await waitFor(() => expect(dragHandlers.size).toBe(1));
  return rendered;
};

const drop = async ({ paths }: { readonly paths: ReadonlyArray<string> }) => {
  await act(async () => {
    dragHandlers.forEach((handler) =>
      handler({ payload: { type: 'drop', position: { x: 10, y: 10 }, paths } }),
    );
  });
};

const messagesOf = ({ showToast }: { readonly showToast: Mock<ShowToast> }) =>
  showToast.mock.calls.map(([toast]) => toast.message);

beforeEach(() => {
  dragHandlers.clear();
  outcomes.clear();
  storySpies.tauriInvoke.mockReset();
  stubStoryInvoke({ attachment_read_dropped: readDropped });
});

afterEach(() => {
  cleanup();
  document.querySelectorAll('[data-drop-composer]').forEach((element) => element.remove());
});

describe('a dropped file that cannot be read says why', () => {
  it('says a screenshot was gone before it could be read', async () => {
    outcomes.set(`${TEMPORARY}/${SHOT}`, GONE);
    const showToast = vi.fn<ShowToast>();
    const { result } = await mountComposer({ showToast });
    await drop({ paths: [`${TEMPORARY}/${SHOT}`] });
    await waitFor(() =>
      expect(messagesOf({ showToast })).toEqual([
        `${SHOT} was moved or deleted before it could be read. Drop the saved file or use Attach files.`,
      ]),
    );
    expect(result.current.attachments).toHaveLength(0);
  });

  it('says Goodboy has no permission to read the file', async () => {
    outcomes.set(`${DESKTOP}/payments-api.png`, DENIED);
    const showToast = vi.fn<ShowToast>();
    const { result } = await mountComposer({ showToast });
    await drop({ paths: [`${DESKTOP}/payments-api.png`] });
    await waitFor(() =>
      expect(messagesOf({ showToast })).toEqual([
        'Goodboy has no permission to read payments-api.png. Use Attach files to pick it.',
      ]),
    );
    expect(result.current.attachments).toHaveLength(0);
  });

  it('says a file of a type the host refuses cannot be attached', async () => {
    outcomes.set(`${DESKTOP}/notify-relay.png`, UNSUPPORTED);
    const showToast = vi.fn<ShowToast>();
    await mountComposer({ showToast });
    await drop({ paths: [`${DESKTOP}/notify-relay.png`] });
    await waitFor(() =>
      expect(messagesOf({ showToast })).toEqual([
        "notify-relay.png can't be attached. Use Attach files to pick an image, PDF, CSV or text file.",
      ]),
    );
  });

  it('says a dropped folder cannot be attached', async () => {
    outcomes.set(`${DESKTOP}/cascadia.png`, FOLDER);
    const showToast = vi.fn<ShowToast>();
    await mountComposer({ showToast });
    await drop({ paths: [`${DESKTOP}/cascadia.png`] });
    await waitFor(() =>
      expect(messagesOf({ showToast })).toEqual([
        "cascadia.png can't be attached. Use Attach files to pick an image, PDF, CSV or text file.",
      ]),
    );
  });

  it('keeps the general note for a cause it cannot name', async () => {
    outcomes.set(`${DESKTOP}/acme.png`, NOT_DROPPED);
    const showToast = vi.fn<ShowToast>();
    await mountComposer({ showToast });
    await drop({ paths: [`${DESKTOP}/acme.png`] });
    await waitFor(() =>
      expect(messagesOf({ showToast })).toEqual([
        "Couldn't attach acme.png. Drop it again or use Attach files.",
      ]),
    );
  });

  it('names a file the host found over the size limit', async () => {
    outcomes.set(`${DESKTOP}/northwind.png`, TOO_LARGE);
    const showToast = vi.fn<ShowToast>();
    await mountComposer({ showToast });
    await drop({ paths: [`${DESKTOP}/northwind.png`] });
    await waitFor(() =>
      expect(messagesOf({ showToast })).toEqual(['northwind.png is over 10 MB.']),
    );
  });

  it('gives one note per cause and attaches the files that could be read', async () => {
    outcomes.set(`${TEMPORARY}/one.png`, GONE);
    outcomes.set(`${TEMPORARY}/two.png`, GONE);
    outcomes.set(`${DESKTOP}/locked.png`, DENIED);
    outcomes.set(`${DESKTOP}/fine.png`, READABLE);
    const showToast = vi.fn<ShowToast>();
    const { result } = await mountComposer({ showToast });
    await drop({
      paths: [
        `${TEMPORARY}/one.png`,
        `${DESKTOP}/locked.png`,
        `${DESKTOP}/fine.png`,
        `${TEMPORARY}/two.png`,
      ],
    });
    await waitFor(() => expect(result.current.attachments).toHaveLength(1));
    expect(result.current.attachments[0]?.fileName).toBe('fine.png');
    expect(messagesOf({ showToast })).toEqual([
      '2 files were moved or deleted before they could be read. Drop the saved files or use Attach files. Goodboy has no permission to read locked.png. Use Attach files to pick it.',
    ]);
  });

  it('points a file of a type the composer never reads to Attach files', async () => {
    const showToast = vi.fn<ShowToast>();
    await mountComposer({ showToast });
    await drop({ paths: [`${DESKTOP}/ledger-core.zip`] });
    await waitFor(() =>
      expect(messagesOf({ showToast })).toEqual([
        "ledger-core.zip can't be attached. Use Attach files to pick an image, PDF, CSV or text file.",
      ]),
    );
    expect(storySpies.tauriInvoke).not.toHaveBeenCalled();
  });

  it('gives one unsupported note for files refused here and by the host', async () => {
    outcomes.set(`${DESKTOP}/notify-relay.png`, UNSUPPORTED);
    const showToast = vi.fn<ShowToast>();
    await mountComposer({ showToast });
    await drop({ paths: [`${DESKTOP}/ledger-core.zip`, `${DESKTOP}/notify-relay.png`] });
    await waitFor(() =>
      expect(messagesOf({ showToast })).toEqual([
        "2 files can't be attached. Use Attach files to pick images, PDFs, CSV or text files.",
      ]),
    );
  });

  it('shows every cause in the New session notice', async () => {
    outcomes.set(`${TEMPORARY}/one.png`, GONE);
    outcomes.set(`${DESKTOP}/locked.png`, DENIED);
    const { result } = renderHook(() => usePromptFiles({ note: 'Images and text files' }));
    const element = document.createElement('div');
    element.setAttribute('data-drop-composer', '');
    document.body.appendChild(element);
    Object.defineProperty(element, 'offsetParent', { value: document.body, configurable: true });
    await act(async () => {
      result.current.files.composerRef.current = element;
    });
    await waitFor(() => expect(dragHandlers.size).toBe(1));
    await drop({ paths: [`${TEMPORARY}/one.png`, `${DESKTOP}/locked.png`] });
    await waitFor(() =>
      expect(result.current.notice).toBe(
        'one.png was moved or deleted before it could be read. Drop the saved file or use Attach files. Goodboy has no permission to read locked.png. Use Attach files to pick it.',
      ),
    );
  });

  it('attaches the file when the user drops the saved copy after a failed drop', async () => {
    outcomes.set(`${TEMPORARY}/${SHOT}`, GONE);
    outcomes.set(`${DESKTOP}/${SHOT}`, READABLE);
    const showToast = vi.fn<ShowToast>();
    const { result } = await mountComposer({ showToast });
    await drop({ paths: [`${TEMPORARY}/${SHOT}`] });
    await waitFor(() => expect(showToast).toHaveBeenCalledTimes(1));
    expect(result.current.attachments).toHaveLength(0);

    await drop({ paths: [`${DESKTOP}/${SHOT}`] });
    await waitFor(() => expect(result.current.attachments).toHaveLength(1));
    expect(result.current.attachments[0]?.fileName).toBe(SHOT);
    expect(showToast).toHaveBeenCalledTimes(1);
    expect(storySpies.tauriInvoke).toHaveBeenLastCalledWith('attachment_read_dropped', {
      absPath: `${DESKTOP}/${SHOT}`,
    });
  });
});
