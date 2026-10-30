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

vi.mock('../../../auto/useAutoTreeLimit', () => ({
  useAutoTreeLimit: () => ({
    usd: 5,
    isFromSession: false,
    isDefault: true,
    defaultUsd: 5,
    isStored: true,
    change: () => undefined,
    persist: async () => undefined,
  }),
}));

import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { brandedId } from '../../../history/testing/brandedId';
import { PROVIDER_CAPABILITIES } from '@goodboy/core';
import type {
  AgentId,
  IsoDateTime,
  ProviderId,
  Session,
  SessionId,
  Workflow,
  WorkflowId,
  WorkspaceId,
} from '@goodboy/types';
import { anAgent, aWorkflowRun } from '@goodboy/types/testing';
import { WritePanel } from '../../../artifacts/components/WritePanel';
import type { AppStore } from '../../../../store/store';
import {
  STORE_IMPORT_TIMEOUT_MS,
  buildStorySession,
  buildStoryWorkspace,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { ToastProvider } from '../../../../shared/components/Toast';
import type { NewDrawerPayload } from '../../../../store/slices/drawer/state';

let useAppStore: StoryStore;
let NewDrawer: typeof import('./index').NewDrawer;

const WORKSPACE_ID = brandedId<WorkspaceId>({ value: 'workspace-harborline' });
const SESSION_ID = brandedId<SessionId>({ value: 'session-harborline' });
const STAMP = brandedId<IsoDateTime>({ value: '2026-10-14T09:00:00.000Z' });

const HARBORLINE = buildStoryWorkspace({
  id: WORKSPACE_ID,
  name: 'Harborline',
  slug: 'harborline',
});

const SESSION: Session = buildStorySession({
  id: SESSION_ID,
  workspaceId: WORKSPACE_ID,
  goal: 'Retry payments through ledger-core',
  providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: true },
});

const connected = (id: ProviderId): AppStore['providers'][number] => ({
  id,
  binary: id,
  capabilities: PROVIDER_CAPABILITIES[id],
  connection: 'connected',
  version: null,
  identity: null,
  label: id,
  error: null,
  docsUrl: '',
});

const spawnAgent = vi.fn<AppStore['spawnAgent']>();

beforeAll(async () => {
  useAppStore = await importStore();
  ({ NewDrawer } = await import('./index'));
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  spawnAgent.mockReset();
  spawnAgent.mockResolvedValue(brandedId<AgentId>({ value: 'agent-1' }));
  useAppStore.setState({
    workspaces: [HARBORLINE],
    currentWorkspaceId: WORKSPACE_ID,
    sessions: [SESSION],
    currentSessionId: SESSION_ID,
    providers: [connected('anthropic')],
    phaseTemplates: { [WORKSPACE_ID]: [] },
    spawnAgent,
  });
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

type OpenParams = {
  readonly payload?: NewDrawerPayload;
  readonly onClose?: () => void;
};

const drawerWith = ({ payload = { form: 'report' }, onClose = vi.fn() }: OpenParams = {}) => (
  <ToastProvider>
    <NewDrawer sessionId={SESSION_ID} payload={payload} writePanel={WritePanel} onClose={onClose} />
  </ToastProvider>
);

const openDrawer = (params: OpenParams = {}) => render(drawerWith(params));

const textAreaOf = (element: HTMLElement): HTMLTextAreaElement => {
  if (!(element instanceof HTMLTextAreaElement)) {
    throw new Error('Expected a text area');
  }
  return element;
};

const buttonOf = (element: HTMLElement): HTMLButtonElement => {
  if (!(element instanceof HTMLButtonElement)) {
    throw new Error('Expected a button');
  }
  return element;
};

const elementOf = (element: Element | null): HTMLElement => {
  if (!(element instanceof HTMLElement)) {
    throw new Error('Expected an element');
  }
  return element;
};

const goalBox = () => textAreaOf(screen.getByRole('textbox', { name: 'Goal' }));

describe('NewDrawer (shell)', () => {
  it('opens one form, titled by it, with no tab bar', () => {
    openDrawer();

    expect(screen.getByRole('region', { name: 'Write a report' })).toBeDefined();
    expect(screen.queryByRole('tablist', { name: 'What to start' })).toBeNull();
  });

  it('follows a later entry while open', () => {
    const view = openDrawer({ payload: { form: 'wireframe' } });
    expect(screen.getByRole('region', { name: 'Draw a wireframe' })).toBeDefined();

    view.rerender(drawerWith({ payload: { form: 'report' } }));
    expect(screen.getByRole('region', { name: 'Write a report' })).toBeDefined();
  });

  it('closes on Escape, the way every drawer does', () => {
    const onClose = vi.fn();
    openDrawer({ onClose });

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledOnce();
  });
});

describe('NewDrawer (Write)', () => {
  it('writes a report with every field the page had, and no format tabs', () => {
    openDrawer({ payload: { form: 'report' } });

    expect(screen.getByRole('region', { name: 'Write a report' })).toBeDefined();
    expect(screen.queryByText('A report written from this session.')).toBeNull();
    expect(screen.queryByRole('tablist', { name: 'Write format' })).toBeNull();
    expect(screen.getByTestId('artifact-brief')).toBeDefined();
    expect(screen.getByText('Context')).toBeDefined();
    expect(screen.queryByRole('button', { name: /^add guidance/i })).toBeNull();
  });

  it('opens the wireframe form and back without losing the report draft', () => {
    const view = openDrawer({ payload: { form: 'report' } });
    fireEvent.change(screen.getByTestId('artifact-brief'), { target: { value: 'the rounding' } });

    view.rerender(drawerWith({ payload: { form: 'wireframe' } }));
    expect(screen.getByRole('region', { name: 'Draw a wireframe' })).toBeDefined();
    view.rerender(drawerWith({ payload: { form: 'report' } }));

    expect(textAreaOf(screen.getByTestId('artifact-brief')).value).toBe('the rounding');
  });

  it('shows the note a retry carries', () => {
    openDrawer({
      payload: { form: 'report', note: 'Retrying the last report' },
    });

    expect(screen.getByTestId('artifact-creation-note').textContent).toBe(
      'Retrying the last report',
    );
  });
});
