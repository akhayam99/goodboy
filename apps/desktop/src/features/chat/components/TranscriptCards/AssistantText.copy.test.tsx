// @vitest-environment happy-dom

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { nextAgentId, nextSessionId, nextWorkspaceId } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  buildStorySession,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { ToastProvider } from '../../../../shared/components/Toast';
import { ObjectMenuProvider } from '../../../actions/components/ObjectMenuProvider';
import { AssistantText } from './AssistantText';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).sqliteDbLibModuleMock(),
);

const WORKSPACE_ID = nextWorkspaceId();
const SESSION_ID = nextSessionId();
const AGENT_ID = nextAgentId();

const MESSAGE = 'The retry loop built a new key on every attempt in payments-api.';

let useAppStore: StoryStore;
const writeText = vi.fn(async (_text: string) => undefined);

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  writeText.mockClear();
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    writable: true,
    configurable: true,
  });
  useAppStore.setState({
    sessions: [buildStorySession({ id: SESSION_ID, workspaceId: WORKSPACE_ID })],
    currentSessionId: SESSION_ID,
  });
});

afterEach(cleanup);

const mount = () =>
  render(
    <ToastProvider>
      <ObjectMenuProvider>
        <AssistantText
          text={MESSAGE}
          sessionId={SESSION_ID}
          agentId={AGENT_ID}
          runId="run-1"
          itemKey="assistant-1"
        />
      </ObjectMenuProvider>
    </ToastProvider>,
  );

const source = ({ file }: { readonly file: string }): string =>
  readFileSync(join(__dirname, file), 'utf8');

describe('Copy on an assistant message', () => {
  it('draws no row under the message: one wrapper holds the button and ends the message', () => {
    const { container } = mount();
    const meta = container.querySelector('[data-message-meta]');

    expect(meta?.parentElement?.lastElementChild).toBe(meta);
    expect(meta?.children).toHaveLength(1);
    expect(meta?.firstElementChild?.getAttribute('aria-label')).toBe('copy message');
  });

  it('reveals through the row-actions utility on the message, never a raw opacity-0 reveal', () => {
    const text = source({ file: 'AssistantText.tsx' });
    const css = readFileSync(join(__dirname, '..', '..', '..', '..', 'styles.css'), 'utf8');
    const block = /@utility row-actions \{[\s\S]*?\n\}/.exec(css)?.[0] ?? '';

    expect(text).toContain('group/row');
    expect(text).toMatch(/data-message-meta=""\s+className="row-actions absolute /);
    expect(text).not.toMatch(/opacity-0/);
    expect(block).toContain(':where(.group\\/row:hover) &');
    expect(block).toContain('&:focus-within');
  });

  it('is a real button that Tab reaches and a press copies the message', async () => {
    mount();
    const copy = screen.getByRole('button', { name: 'copy message' });

    copy.focus();
    expect(document.activeElement).toBe(copy);
    expect(copy.getAttribute('tabindex')).toBeNull();
    fireEvent.click(copy);

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(MESSAGE));
  });

  it('stays in the context menu of the message with Copy message and Copy as Markdown', async () => {
    const { container } = mount();
    const root = container.querySelector('[data-message-meta]')?.parentElement;
    if (!(root instanceof HTMLElement)) {
      throw new Error('no message root');
    }

    fireEvent.contextMenu(root);

    const copy = await screen.findByRole('menuitem', { name: /Copy message/ });
    screen.getByRole('menuitem', { name: /Copy as Markdown/ });
    fireEvent.click(copy);
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(MESSAGE));
  });

  it('opens the same menu from the keyboard on the copy button', async () => {
    mount();

    fireEvent.keyDown(screen.getByRole('button', { name: 'copy message' }), {
      key: 'F10',
      shiftKey: true,
    });

    await screen.findByRole('menuitem', { name: /Copy message/ });
  });
});
