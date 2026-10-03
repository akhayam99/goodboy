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
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { WorkspaceId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../store/storyHarness';
import { ChatComposer } from '.';

const WORKSPACE_ID = 'ws-harborline' as WorkspaceId;

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

type MountParams = {
  readonly isStreaming?: boolean;
};

const mount = ({ isStreaming = false }: MountParams = {}) => {
  const sent: string[] = [];
  const stops: number[] = [];
  render(
    <ChatComposer
      workspaceId={WORKSPACE_ID}
      placeholder="Ask about Harborline, read-only"
      routing={{ provider: 'anthropic', model: 'sonnet-5.5', effort: null }}
      projectCount={3}
      isStreaming={isStreaming}
      isStopping={false}
      onSend={(text) => sent.push(text)}
      onStop={() => stops.push(1)}
      onRouting={() => undefined}
    />,
  );
  return { sent, stops };
};

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

  it('takes no files in this release', () => {
    mount();
    expect(screen.queryByRole('button', { name: 'Attach files' })).toBeNull();
  });
});
