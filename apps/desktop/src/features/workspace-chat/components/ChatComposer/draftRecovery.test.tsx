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
import { brandId, type WorkspaceId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../store/storyHarness';
import { NAMES } from '../../../../shared/utils/names';
import { ChatComposer, type ChatComposerMessage } from '.';

const WORKSPACE_ID = brandId<WorkspaceId>({ value: 'ws-harborline' });

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

type SendResolver = (isSent: boolean) => void;

const mount = () => {
  const resolvers: SendResolver[] = [];
  const messages: ChatComposerMessage[] = [];
  render(
    <ChatComposer
      workspaceId={WORKSPACE_ID}
      placeholder="Ask about Harborline, read-only"
      routing={{ provider: 'anthropic', model: 'sonnet-5.5', effort: null }}
      isStreaming={false}
      isStopping={false}
      onSend={(message) => {
        messages.push(message);
        return new Promise<boolean>((resolve) => resolvers.push(resolve));
      }}
      onStop={() => undefined}
      onRouting={() => undefined}
    />,
  );
  return { messages, resolvers };
};

const field = (): HTMLTextAreaElement => {
  const box = screen.getByRole('textbox', { name: 'Message' });
  if (!(box instanceof HTMLTextAreaElement)) {
    throw new Error('the Chat field is not a textarea');
  }
  return box;
};

const png = (name: string) =>
  new File([new Uint8Array([137, 80, 78, 71])], name, { type: 'image/png' });

type SettleParams = {
  readonly resolvers: ReadonlyArray<SendResolver>;
  readonly isSent: boolean;
};

const settle = async ({ resolvers, isSent }: SettleParams) => {
  await act(async () => {
    resolvers[0]?.(isSent);
    await Promise.resolve();
  });
};

describe('the Chat composer when a send is refused', () => {
  it('empties the field while the send is pending and puts the message back when it is refused', async () => {
    const { messages, resolvers } = mount();
    fireEvent.change(field(), { target: { value: 'Why did notify-relay retry?' } });

    fireEvent.keyDown(field(), { key: 'Enter' });

    expect(messages.map((message) => message.text)).toEqual(['Why did notify-relay retry?']);
    expect(field().value).toBe('');
    await settle({ resolvers, isSent: false });
    await waitFor(() => expect(field().value).toBe('Why did notify-relay retry?'));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('keeps nothing once the send landed', async () => {
    const { resolvers } = mount();
    fireEvent.change(field(), { target: { value: 'Any open incidents?' } });
    fireEvent.keyDown(field(), { key: 'Enter' });

    await settle({ resolvers, isSent: true });

    expect(field().value).toBe('');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('does not overwrite what was typed while the send was pending', async () => {
    const { resolvers } = mount();
    fireEvent.change(field(), { target: { value: 'first message' } });
    fireEvent.keyDown(field(), { key: 'Enter' });
    fireEvent.change(field(), { target: { value: 'a better message' } });

    await settle({ resolvers, isSent: false });

    expect(field().value).toBe('a better message');
  });

  it('puts the images back with a notice, even when the message had no text', async () => {
    const { resolvers } = mount();
    await act(async () => {
      fireEvent.paste(field(), { clipboardData: { files: [png('cascadia-trace.png')] } });
    });
    await screen.findByText('cascadia-trace.png');
    fireEvent.keyDown(field(), { key: 'Enter' });
    expect(screen.queryByText('cascadia-trace.png')).toBeNull();

    await settle({ resolvers, isSent: false });

    await screen.findByText('cascadia-trace.png');
    expect(screen.getByRole('alert').textContent).toBe("Couldn't attach the images. Try again.");
  });
});

describe('the Chat send button', () => {
  it('is the shared Send control, with the shared name and size', () => {
    mount();

    const button = screen.getByRole('button', { name: NAMES.send });

    expect(button.getAttribute('data-size')).toBe('sm');
  });
});
