// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../../store/storyHarness')).dbModuleMock());
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { WorkspaceId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { SETTING_CHAT_IMAGES } from '../../../settings/settings';
import { ChatComposer, type ChatComposerMessage } from '.';

const WORKSPACE_ID = 'ws-harborline' as WorkspaceId;

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

type MountParams = {
  readonly isStreaming?: boolean;
  readonly isSent?: boolean;
};

const mount = ({ isStreaming = false, isSent = true }: MountParams = {}) => {
  const sent: string[] = [];
  const messages: ChatComposerMessage[] = [];
  const stops: number[] = [];
  render(
    <ChatComposer
      workspaceId={WORKSPACE_ID}
      placeholder="Ask about Harborline, read-only"
      routing={{ provider: 'anthropic', model: 'sonnet-5.5', effort: null }}
      projectCount={3}
      isStreaming={isStreaming}
      isStopping={false}
      onSend={async (message) => {
        sent.push(message.text);
        messages.push(message);
        return isSent;
      }}
      onStop={() => stops.push(1)}
      onRouting={() => undefined}
    />,
  );
  return { sent, stops, messages };
};

const png = (name: string) =>
  new File([new Uint8Array([137, 80, 78, 71])], name, { type: 'image/png' });

const paste = (files: ReadonlyArray<File>) =>
  act(async () => {
    fireEvent.paste(field(), { clipboardData: { files } });
  });

const field = () => screen.getByRole('textbox', { name: 'Message' });

describe('ChatComposer', () => {
  it('is a message field: Shift+Enter adds a line, Enter sends the trimmed text', () => {
    const { sent } = mount();
    expect(field().getAttribute('data-prompt-kind')).toBe('message');

    fireEvent.change(field(), {
      target: { value: '  Why did retries double?\nIn payments-api  ' },
    });
    expect(fireEvent.keyDown(field(), { key: 'Enter', shiftKey: true })).toBe(true);
    expect(sent).toEqual([]);

    expect(fireEvent.keyDown(field(), { key: 'Enter' })).toBe(false);
    expect(sent).toEqual(['Why did retries double?\nIn payments-api']);
    expect(field()).toHaveProperty('value', '');
  });

  it('keeps Send off on an empty field and sends nothing on Enter', () => {
    const { sent } = mount();
    expect(screen.getByRole('button', { name: 'Send' }).hasAttribute('disabled')).toBe(true);
    fireEvent.keyDown(field(), { key: 'Enter' });
    expect(sent).toEqual([]);
  });

  it('offers Stop instead of Send while the answer streams, and holds the draft', () => {
    const { sent, stops } = mount({ isStreaming: true });
    fireEvent.change(field(), { target: { value: 'and notify-relay?' } });
    fireEvent.keyDown(field(), { key: 'Enter' });
    expect(sent).toEqual([]);
    expect(screen.queryByRole('button', { name: 'Send' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Stop the answer' }));
    expect(stops).toEqual([1]);
  });

  it('turns a pasted image into a chip and sends it, even with no text', async () => {
    const { messages } = mount();
    await paste([png('acme-trace.png')]);
    expect((await screen.findByText('acme-trace.png')).textContent).toBe('acme-trace.png');
    expect(screen.getByText('1 of 10 images').textContent).toBe('1 of 10 images');
    expect(screen.getByRole('button', { name: 'Send' }).hasAttribute('disabled')).toBe(false);

    fireEvent.keyDown(field(), { key: 'Enter' });
    expect(messages.map((message) => message.text)).toEqual(['']);
    expect(messages[0]?.images.map((image) => image.fileName)).toEqual(['acme-trace.png']);
    expect(screen.queryByText('acme-trace.png')).toBeNull();
  });

  it('takes only images Chat can read', async () => {
    mount();
    expect(screen.getByLabelText('Choose images to attach').getAttribute('accept')).toBe(
      'image/png,image/jpeg,image/gif,image/webp',
    );
    await paste([new File(['%PDF'], 'runbook.pdf', { type: 'application/pdf' })]);
    expect(screen.queryByText('runbook.pdf')).toBeNull();
    expect(screen.getByRole('button', { name: 'Send' }).hasAttribute('disabled')).toBe(true);
  });

  it('puts the text and the images back when the send fails', async () => {
    mount({ isSent: false });
    fireEvent.change(field(), { target: { value: 'Same 502 on Acme sandbox.' } });
    await paste([png('acme-trace.png')]);
    await screen.findByText('acme-trace.png');
    fireEvent.keyDown(field(), { key: 'Enter' });
    await waitFor(() => expect(field()).toHaveProperty('value', 'Same 502 on Acme sandbox.'));
    expect(screen.getByText('acme-trace.png').textContent).toBe('acme-trace.png');
    expect(screen.getByRole('alert').textContent).toBe("Couldn't attach the images. Try again.");
  });

  it('takes no images when the chat images switch is off', async () => {
    useAppStore.setState({ settings: { [SETTING_CHAT_IMAGES]: 'false' } });
    mount();
    expect(screen.queryByRole('button', { name: 'Attach images' })).toBeNull();
    await paste([png('acme-trace.png')]);
    expect(screen.queryByText('acme-trace.png')).toBeNull();
    expect(screen.getByRole('button', { name: 'Send' }).hasAttribute('disabled')).toBe(true);
  });
});
