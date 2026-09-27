// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { WorkspaceId } from '@goodboy/types';

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
    sessionDrafts: {} as Record<string, unknown>,
    loadPhaseTemplates: vi.fn(async () => undefined),
    patchSessionDraft: vi.fn(),
    startSessionFromDraft: vi.fn(async () => undefined),
  },
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(selector: (state: typeof store) => T) => selector(store),
}));

import { EMPTY_SESSION_DRAFT } from '../../../../store/slices/sessionDraft/state';
import { WorkflowStart } from './WorkflowStart';

const WORKSPACE_ID = 'ws-1' as WorkspaceId;

beforeEach(() => {
  store.phaseTemplates = {};
  store.sessionDrafts = { 'ws-1': { ...EMPTY_SESSION_DRAFT, workflowMode: 'preset' } };
  localStorage.clear();
  store.loadPhaseTemplates.mockClear();
  store.patchSessionDraft.mockClear();
  store.startSessionFromDraft.mockClear();
});
afterEach(cleanup);

const renderStart = () => render(<WorkflowStart workspaceId={WORKSPACE_ID} />);

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

  const draftWith = (patch: Record<string, unknown>) => {
    store.sessionDrafts = { 'ws-1': { ...EMPTY_SESSION_DRAFT, workflowGoal: 'Ship it', ...patch } };
  };

  it('offers Orchestrated, Custom and Preset, Orchestrated first time', () => {
    draftWith({});
    renderStart();

    const tabs = screen.getAllByRole('tab').map((tab) => tab.textContent);
    expect(tabs).toEqual(['Orchestrated', 'Custom', 'Preset']);
    expect(screen.getByRole('tab', { name: 'Orchestrated' }).getAttribute('aria-selected')).toBe(
      'true',
    );
    expect(screen.queryByRole('list', { name: 'Built in' })).toBeNull();
  });

  it('remembers the approach for the draft and the builder', () => {
    draftWith({});
    renderStart();
    fireEvent.click(screen.getByRole('tab', { name: 'Custom' }));

    expect(store.patchSessionDraft).toHaveBeenCalledWith({
      workspaceId: WORKSPACE_ID,
      patch: { workflowMode: 'custom' },
    });
    expect(localStorage.getItem('goodboy:workflow-builder-mode:ws-1')).toBe('custom');
  });

  it('opens the shared builder for an orchestrated run', () => {
    draftWith({ workflowMode: 'dynamic' });
    renderStart();
    fireEvent.click(screen.getByRole('button', { name: 'Set up orchestration' }));

    expect(store.startSessionFromDraft).toHaveBeenCalledWith({
      workspaceId: WORKSPACE_ID,
      start: { kind: 'workflow-builder', choice: { kind: 'orchestrated' }, goal: 'Ship it' },
    });
  });

  it('opens the shared builder for custom steps', () => {
    draftWith({ workflowMode: 'custom' });
    renderStart();
    fireEvent.click(screen.getByRole('button', { name: 'Set up the steps' }));

    expect(store.startSessionFromDraft).toHaveBeenCalledWith({
      workspaceId: WORKSPACE_ID,
      start: { kind: 'workflow-builder', choice: { kind: 'custom' }, goal: 'Ship it' },
    });
  });

  it('runs a preset straight away', () => {
    store.phaseTemplates = {
      'ws-1': [{ id: 'wf-1', name: 'Plan and ship', description: '', origin: 'library' }],
    };
    draftWith({ workflowMode: 'preset' });
    renderStart();

    fireEvent.click(screen.getByRole('button', { name: 'Run workflow' }));
    expect(store.startSessionFromDraft).toHaveBeenLastCalledWith({
      workspaceId: WORKSPACE_ID,
      start: { kind: 'workflow', workflowId: 'wf-1', goal: 'Ship it' },
    });
  });

  it('opens a preset in the builder to edit its steps', () => {
    store.phaseTemplates = {
      'ws-1': [{ id: 'wf-1', name: 'Plan and ship', description: '', origin: 'library' }],
    };
    draftWith({ workflowMode: 'preset' });
    renderStart();

    fireEvent.click(screen.getByRole('button', { name: 'Edit steps' }));
    expect(store.startSessionFromDraft).toHaveBeenLastCalledWith({
      workspaceId: WORKSPACE_ID,
      start: {
        kind: 'workflow-builder',
        choice: { kind: 'preset', workflow: expect.objectContaining({ id: 'wf-1' }) },
        goal: 'Ship it',
      },
    });
  });

  it('waits for the goal before any start', () => {
    store.sessionDrafts = { 'ws-1': { ...EMPTY_SESSION_DRAFT, workflowMode: 'dynamic' } };
    renderStart();

    expect(
      (screen.getByRole('button', { name: 'Set up orchestration' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(screen.getByText('Write the goal first.')).toBeDefined();
  });
});
