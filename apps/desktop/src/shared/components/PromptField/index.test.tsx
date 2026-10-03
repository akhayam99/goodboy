// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useState } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useAppStore } from '../../../store';
import { SETTING_COMPOSER_CLASSIC_KEYS } from '../../../features/settings/settings';
import { usePendingAttachments } from '../../hooks/usePendingAttachments';
import { shortcutGlyphs } from '../../keyboard/registry';
import { PromptField, type PromptSubmitMode } from '.';
import type { PromptFieldKind } from './promptKeyAction';

type HarnessProps = {
  readonly kind: PromptFieldKind;
  readonly withFiles: boolean;
  readonly canSendNow?: boolean;
  readonly hasChangedKeys?: boolean;
  readonly hasPreview?: boolean;
  readonly sent: Array<{ readonly mode: PromptSubmitMode; readonly text: string }>;
};

const Harness = ({
  kind,
  withFiles,
  canSendNow = false,
  hasChangedKeys = false,
  hasPreview = false,
  sent,
}: HarnessProps) => {
  const [value, setValue] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const pending = usePendingAttachments({ showToast: ({ message }) => setNotice(message) });
  return (
    <PromptField
      kind={kind}
      label="Prompt"
      value={value}
      onChange={setValue}
      onSubmit={(mode) => sent.push({ mode, text: value })}
      canSendNow={canSendNow}
      hasChangedKeys={hasChangedKeys}
      hasPreview={hasPreview}
      notice={notice}
      keyLabels={{ send: 'send', now: 'send now' }}
      {...(withFiles && {
        files: {
          attachments: pending.attachments,
          isDragging: pending.isDragging,
          composerRef: pending.composerRef,
          fileInputRef: pending.fileInputRef,
          onPaste: pending.onPaste,
          onFileInputChange: pending.onFileInputChange,
          onRemove: pending.removeAttachment,
          note: 'Images go to the next agent',
        },
      })}
    />
  );
};

type KeyRow = {
  readonly name: string;
  readonly kind: PromptFieldKind;
  readonly canSendNow: boolean;
  readonly isClassic: boolean;
  readonly key: { readonly shiftKey?: boolean; readonly metaKey?: boolean };
  readonly sends: PromptSubmitMode | null;
};

const KEY_ROWS: ReadonlyArray<KeyRow> = [
  {
    name: 'message, Enter sends',
    kind: 'message',
    canSendNow: false,
    isClassic: false,
    key: {},
    sends: 'send',
  },
  {
    name: 'message, Shift+Enter adds a line',
    kind: 'message',
    canSendNow: false,
    isClassic: false,
    key: { shiftKey: true },
    sends: null,
  },
  {
    name: 'message, Cmd+Enter sends now where it exists',
    kind: 'message',
    canSendNow: true,
    isClassic: false,
    key: { metaKey: true },
    sends: 'now',
  },
  {
    name: 'message, Cmd+Enter sends where there is no now',
    kind: 'message',
    canSendNow: false,
    isClassic: false,
    key: { metaKey: true },
    sends: 'send',
  },
  {
    name: 'document, Enter adds a line',
    kind: 'document',
    canSendNow: false,
    isClassic: false,
    key: {},
    sends: null,
  },
  {
    name: 'document, Shift+Enter adds a line',
    kind: 'document',
    canSendNow: false,
    isClassic: false,
    key: { shiftKey: true },
    sends: null,
  },
  {
    name: 'document, Cmd+Enter saves',
    kind: 'document',
    canSendNow: false,
    isClassic: false,
    key: { metaKey: true },
    sends: 'send',
  },
  {
    name: 'classic keys, Enter adds a line in a changed message field',
    kind: 'message',
    canSendNow: false,
    isClassic: true,
    key: {},
    sends: null,
  },
  {
    name: 'classic keys, Cmd+Enter sends a changed message field',
    kind: 'message',
    canSendNow: false,
    isClassic: true,
    key: { metaKey: true },
    sends: 'send',
  },
];

type FileRow = {
  readonly kind: PromptFieldKind;
  readonly withFiles: boolean;
};

const FILE_ROWS: ReadonlyArray<FileRow> = [
  { kind: 'message', withFiles: true },
  { kind: 'message', withFiles: false },
  { kind: 'document', withFiles: true },
  { kind: 'document', withFiles: false },
];

const image = (name: string, bytes = 4): File =>
  new File([new Uint8Array(bytes)], name, { type: 'image/png' });

const field = () => screen.getByRole('textbox', { name: 'Prompt' });

const settle = async () => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
};

beforeEach(() => {
  useAppStore.setState({ settings: { [SETTING_COMPOSER_CLASSIC_KEYS]: 'false' } });
});

afterEach(cleanup);

describe('PromptField keys', () => {
  it.each(KEY_ROWS.map((row) => [row.name, row] as const))('%s', (_name, row) => {
    useAppStore.setState({
      settings: { [SETTING_COMPOSER_CLASSIC_KEYS]: row.isClassic ? 'true' : 'false' },
    });
    const sent: HarnessProps['sent'] = [];
    render(
      <Harness
        kind={row.kind}
        withFiles={false}
        canSendNow={row.canSendNow}
        hasChangedKeys={row.isClassic}
        sent={sent}
      />,
    );
    fireEvent.change(field(), { target: { value: 'Keep the retry budget' } });
    const isDefaultKept = fireEvent.keyDown(field(), { key: 'Enter', code: 'Enter', ...row.key });
    expect(sent).toEqual(
      row.sends === null ? [] : [{ mode: row.sends, text: 'Keep the retry budget' }],
    );
    expect(isDefaultKept).toBe(row.sends === null);
  });

  it('keeps the new keys on a field whose keys did not change, even with classic keys on', () => {
    useAppStore.setState({ settings: { [SETTING_COMPOSER_CLASSIC_KEYS]: 'true' } });
    const sent: HarnessProps['sent'] = [];
    render(<Harness kind="message" withFiles={false} sent={sent} />);
    fireEvent.change(field(), { target: { value: 'hi' } });
    fireEvent.keyDown(field(), { key: 'Enter', code: 'Enter' });
    expect(sent).toEqual([{ mode: 'send', text: 'hi' }]);
  });

  it('shows the keys of its kind, read from the shortcut registry', () => {
    const sent: HarnessProps['sent'] = [];
    const { unmount } = render(<Harness kind="message" withFiles={false} canSendNow sent={sent} />);
    const send = shortcutGlyphs('composer.send');
    const newLine = shortcutGlyphs('composer.newLine');
    const submit = shortcutGlyphs('composer.submit');
    expect(screen.getByTestId('prompt-keys').textContent).toBe(
      `${send}send${newLine}new line${submit}send now`,
    );
    unmount();
    render(<Harness kind="document" withFiles={false} sent={sent} />);
    expect(screen.getByTestId('prompt-keys').textContent).toBe(`${send}new line${submit}send`);
  });
});

describe('PromptField files', () => {
  it.each(
    FILE_ROWS.map((row) => [`${row.kind}, files ${row.withFiles ? 'on' : 'off'}`, row] as const),
  )('%s', async (_name, row) => {
    const sent: HarnessProps['sent'] = [];
    render(<Harness kind={row.kind} withFiles={row.withFiles} sent={sent} />);
    expect(screen.queryByRole('button', { name: 'Attach files' }) !== null).toBe(row.withFiles);
    const isDefaultKept = fireEvent.paste(field(), {
      clipboardData: { files: [image('checkout-502.png')] },
    });
    await settle();
    expect(isDefaultKept).toBe(!row.withFiles);
    expect(screen.queryByRole('button', { name: 'Remove checkout-502.png' }) !== null).toBe(
      row.withFiles,
    );
    expect(screen.queryByText('1 of 10 files') !== null).toBe(row.withFiles);
    const overlay = document.querySelector('[data-state]');
    expect(overlay?.getAttribute('data-state') ?? 'none').toBe(row.withFiles ? 'idle' : 'none');
  });

  it('turns down the eleventh image, says so in the field and locks the attach button', async () => {
    const sent: HarnessProps['sent'] = [];
    render(<Harness kind="message" withFiles sent={sent} />);
    const input = screen.getByLabelText('Choose files to attach');
    const files = Array.from({ length: 11 }, (_, index) => image(`shot-${index + 1}.png`));
    fireEvent.change(input, { target: { files } });
    await waitFor(() => expect(screen.getByText('10 of 10 files')).toBeDefined());
    expect(screen.getByRole('alert').textContent).toBe('Up to 10 files per message.');
    expect(screen.queryByRole('button', { name: 'Remove shot-11.png' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Attach files' }).hasAttribute('disabled')).toBe(
      true,
    );
  });

  it('turns down an image over 10 MB', async () => {
    const sent: HarnessProps['sent'] = [];
    render(<Harness kind="document" withFiles sent={sent} />);
    fireEvent.paste(field(), {
      clipboardData: { files: [image('huge.png', 10 * 1024 * 1024 + 1)] },
    });
    await settle();
    expect(screen.getByRole('alert').textContent).toBe('huge.png is over 10 MB.');
    expect(screen.queryByRole('button', { name: 'Remove huge.png' })).toBeNull();
  });

  it('frees the thumbnail url of a removed image', async () => {
    const created: string[] = [];
    const revoked: string[] = [];
    const create = URL.createObjectURL;
    const revoke = URL.revokeObjectURL;
    URL.createObjectURL = (blob: Blob | MediaSource) => {
      const url = create(blob);
      created.push(url);
      return url;
    };
    URL.revokeObjectURL = (url: string) => {
      revoked.push(url);
      revoke(url);
    };
    try {
      const sent: HarnessProps['sent'] = [];
      render(<Harness kind="message" withFiles sent={sent} />);
      fireEvent.paste(field(), { clipboardData: { files: [image('trace.png')] } });
      await settle();
      expect(created).toHaveLength(1);
      fireEvent.click(screen.getByRole('button', { name: 'Remove trace.png' }));
      await settle();
      expect(revoked).toEqual(created);
    } finally {
      URL.createObjectURL = create;
      URL.revokeObjectURL = revoke;
    }
  });
});

describe('PromptField preview', () => {
  it('renders markdown only when Preview is picked, from the text at that moment', async () => {
    const sent: HarnessProps['sent'] = [];
    render(<Harness kind="document" withFiles={false} hasPreview sent={sent} />);
    fireEvent.change(field(), { target: { value: 'cap the backoff at **2 s**' } });
    expect(screen.queryByTestId('prompt-preview')).toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: 'Preview' }));
    const preview = await screen.findByTestId('prompt-preview');
    expect(preview.querySelector('strong')?.textContent).toBe('2 s');
    expect(screen.queryByRole('textbox', { name: 'Prompt' })).toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: 'Write' }));
    expect(field()).toHaveProperty('value', 'cap the backoff at **2 s**');
  });

  it('says there is nothing to preview on an empty field', async () => {
    const sent: HarnessProps['sent'] = [];
    render(<Harness kind="message" withFiles={false} hasPreview sent={sent} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Preview' }));
    expect((await screen.findByTestId('prompt-preview')).textContent).toBe('Nothing to preview');
  });
});
