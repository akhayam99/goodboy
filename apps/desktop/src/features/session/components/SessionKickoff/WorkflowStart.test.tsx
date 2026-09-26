// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { Session, SessionId } from '@goodboy/types';

const { store } = vi.hoisted(() => ({
  store: {
    phaseTemplates: {} as Record<
      string,
      ReadonlyArray<{
        id: string;
        name: string;
        description: string;
        origin?: string;
        isPreset?: boolean;
        deletedAt?: string;
      }>
    >,
    loadPhaseTemplates: vi.fn(async () => undefined),
    attachWorkflowToSession: vi.fn(async () => undefined),
    reportError: vi.fn(async () => undefined),
  },
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(selector: (state: typeof store) => T) => selector(store),
}));

import { WorkflowStart } from './WorkflowStart';

const SESSION_ID = 'sess-1' as SessionId;
const session = { id: SESSION_ID, workspaceId: 'ws-1', goal: '' } as unknown as Session;

beforeEach(() => {
  store.phaseTemplates = {};
  store.loadPhaseTemplates.mockClear();
  store.attachWorkflowToSession.mockClear();
  store.reportError.mockClear();
});
afterEach(cleanup);

const renderStart = () =>
  render(<WorkflowStart session={session} onOpenWorkflowBuilder={vi.fn()} />);

describe('WorkflowStart', () => {
  it('groups built in and custom presets under their own eyebrow', () => {
    store.phaseTemplates = {
      'ws-1': [
        { id: 'wf-1', name: 'Plan and ship', description: '', origin: 'library' },
        { id: 'wf-2', name: 'Weekly digest', description: '', origin: 'custom' },
      ],
    };
    renderStart();

    expect(screen.getByRole('list', { name: 'Built in' })).toBeDefined();
    expect(screen.getByRole('list', { name: 'Saved' })).toBeDefined();
    expect(screen.getByRole('button', { name: /Plan and ship/ })).toBeDefined();
    expect(screen.getByRole('button', { name: /Weekly digest/ })).toBeDefined();
  });

  it('drops a one-off run copy from both groups', () => {
    store.phaseTemplates = {
      'ws-1': [
        { id: 'wf-1', name: 'Plan and ship', description: '', origin: 'library' },
        { id: 'wf-2', name: 'Run 42', description: '', origin: 'custom', isPreset: false },
      ],
    };
    renderStart();

    expect(screen.queryByRole('button', { name: /Run 42/ })).toBeNull();
  });

  it('hides a group with nothing in it', () => {
    store.phaseTemplates = {
      'ws-1': [{ id: 'wf-1', name: 'Weekly digest', description: '', origin: 'custom' }],
    };
    renderStart();

    expect(screen.queryByRole('list', { name: 'Built in' })).toBeNull();
    expect(screen.getByRole('list', { name: 'Saved' })).toBeDefined();
  });

  it('preselects the first built in preset over a saved one', () => {
    store.phaseTemplates = {
      'ws-1': [
        { id: 'wf-1', name: 'Weekly digest', description: '', origin: 'custom' },
        { id: 'wf-2', name: 'Plan and ship', description: '', origin: 'library' },
      ],
    };
    renderStart();

    expect(screen.getByRole('button', { name: /Plan and ship/ }).getAttribute('aria-pressed')).toBe(
      'true',
    );
  });
});
