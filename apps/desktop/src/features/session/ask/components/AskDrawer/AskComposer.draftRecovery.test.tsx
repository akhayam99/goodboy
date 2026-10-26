// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { NAMES } from '../../../../../shared/utils/names';
import { SESSION } from '../../../../../app/components/MockScene/scenes/activityRunSeed';
import { AskComposer } from './AskComposer';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

type SendResolver = (isSent: boolean) => void;

const mount = () => {
  const resolvers: SendResolver[] = [];
  const sent: string[] = [];
  render(
    <AskComposer
      sessionId={SESSION.id}
      isStreaming={false}
      isStopping={false}
      onSend={(question) => {
        sent.push(question);
        return new Promise<boolean>((resolve) => resolvers.push(resolve));
      }}
      onStop={() => undefined}
    />,
  );
  return { sent, resolvers };
};

const field = (): HTMLTextAreaElement => {
  const box = screen.getByRole('textbox', { name: 'Ask about this session' });
  if (!(box instanceof HTMLTextAreaElement)) {
    throw new Error('the Ask field is not a textarea');
  }
  return box;
};

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

describe('the Ask composer when a send is refused', () => {
  it('empties the field while the send is pending and puts the question back when it is refused', async () => {
    const { sent, resolvers } = mount();
    fireEvent.change(field(), { target: { value: '  why is Harborline red?  ' } });

    fireEvent.keyDown(field(), { key: 'Enter' });

    expect(sent).toEqual(['why is Harborline red?']);
    expect(field().value).toBe('');
    await settle({ resolvers, isSent: false });
    await waitFor(() => expect(field().value).toBe('  why is Harborline red?  '));
  });

  it('keeps nothing once the send landed', async () => {
    const { resolvers } = mount();
    fireEvent.change(field(), { target: { value: 'what needs me?' } });
    fireEvent.keyDown(field(), { key: 'Enter' });

    await settle({ resolvers, isSent: true });

    expect(field().value).toBe('');
    expect(useAppStore.getState().askDrafts).toEqual({});
  });

  it('does not overwrite what was typed while the send was pending', async () => {
    const { resolvers } = mount();
    fireEvent.change(field(), { target: { value: 'first question' } });
    fireEvent.keyDown(field(), { key: 'Enter' });
    fireEvent.change(field(), { target: { value: 'a better question' } });

    await settle({ resolvers, isSent: false });

    expect(field().value).toBe('a better question');
  });

  it('sends nothing for an empty field', () => {
    const { sent } = mount();

    fireEvent.keyDown(field(), { key: 'Enter' });

    expect(sent).toEqual([]);
  });
});

describe('the Ask send button', () => {
  it('is the shared Send control, with the shared name and size', () => {
    mount();

    const button = screen.getByRole('button', { name: NAMES.send });

    expect(button.getAttribute('data-size')).toBe('sm');
  });
});
