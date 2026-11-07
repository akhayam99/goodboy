// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).sqliteDbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { brandId, type Agent, type StepId, type WorkflowId } from '@goodboy/types';
import { aSession, aWorkflow } from '@goodboy/types/testing';
import {
  AUTO_SEED_ROOT,
  AUTO_SEED_SESSION,
  seedAutoSession,
} from '@goodboy/db/test-helpers/auto-seeds';
import {
  importStore,
  openStorySqlite,
  resetStoryStore,
  storySqlite,
  type StoryStore,
} from '../../../../store/storyHarness';
import { invokeAgentList } from '../../../workflows/workflows';
import { AgentHeaderActions } from '../AgentHeaderActions';
import { RunStepHeading } from '../PresetRun/RunStepHeading';
import { AgentTitle } from './AgentTitle';

let useAppStore: StoryStore;
const KINDS: ReadonlyArray<NonNullable<Agent['kind']>> = ['implementer', 'auto'];

beforeAll(async () => {
  useAppStore = await importStore();
});
beforeEach(async () => {
  await resetStoryStore();
  await openStorySqlite();
  await seedAutoSession({ db: storySqlite() });
});
afterEach(cleanup);

type MountParams = {
  readonly kind: NonNullable<Agent['kind']>;
};

const mount = async ({ kind }: MountParams) => {
  await storySqlite().execute('UPDATE agents SET name = ?, kind = ? WHERE id = ?', [
    kind === 'auto' ? 'Auto' : 'Implementer',
    kind,
    AUTO_SEED_ROOT,
  ]);
  const agents = await invokeAgentList(AUTO_SEED_SESSION);
  const agent = agents.find((one) => one.id === AUTO_SEED_ROOT);
  if (agent === undefined) {
    throw new Error('Harborline agent missing');
  }
  useAppStore.setState({
    sessions: [aSession({ id: AUTO_SEED_SESSION })],
    sessionPhaseRuns: { [AUTO_SEED_SESSION]: agents },
  });
  return render(
    <>
      <AgentTitle agent={agent} sessionId={AUTO_SEED_SESSION} />
      <AgentHeaderActions agent={agent} sessionId={AUTO_SEED_SESSION} hasStateButton={false} />
    </>,
  );
};

describe('agent title rename through the real menu and database', () => {
  it.each(KINDS)('renames %s from its menu and keeps the name after reload', async (kind) => {
    await mount({ kind });
    fireEvent.click(screen.getByRole('button', { name: 'More agent actions' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Rename' }));
    const input = await screen.findByRole('textbox', { name: 'Rename agent' });
    expect(document.activeElement).toBe(input);
    fireEvent.change(input, { target: { value: 'Northwind ledger review' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(screen.queryByRole('textbox')).toBeNull());
    expect(
      useAppStore
        .getState()
        .sessionPhaseRuns[AUTO_SEED_SESSION]?.find((agent) => agent.id === AUTO_SEED_ROOT)?.name,
    ).toBe('Northwind ledger review');
    cleanup();
    const reloaded = (await invokeAgentList(AUTO_SEED_SESSION)).find(
      (agent) => agent.id === AUTO_SEED_ROOT,
    );
    if (reloaded === undefined) {
      throw new Error('Harborline agent did not reload');
    }
    render(<AgentTitle agent={reloaded} sessionId={AUTO_SEED_SESSION} />);
    screen.getByText('Northwind ledger review');
  });
  it('renames a run step by double click, reloads it, and leaves the workflow step alone', async () => {
    const db = storySqlite();
    const workflowId = brandId<WorkflowId>({ value: 'workflow-harborline' });
    const stepId = brandId<StepId>({ value: 'step-ledger-core' });
    await db.execute(
      'INSERT INTO workflows (id, workspace_id, name, created_at, updated_at) VALUES (?, ?, ?, 1, 1)',
      [workflowId, 'workspace-harborline', 'Harborline'],
    );
    await db.execute('INSERT INTO steps (id, workflow_id, ordinal, name) VALUES (?, ?, 0, ?)', [
      stepId,
      workflowId,
      'Implementer',
    ]);
    await db.execute('UPDATE agents SET name = ?, kind = ?, step_id = ? WHERE id = ?', [
      'Implementer',
      'implementer',
      stepId,
      AUTO_SEED_ROOT,
    ]);
    const agent = (await invokeAgentList(AUTO_SEED_SESSION))[0];
    if (agent === undefined) {
      throw new Error('Harborline step missing');
    }
    useAppStore.setState({ sessionPhaseRuns: { [AUTO_SEED_SESSION]: [agent] } });
    const workflow = aWorkflow({
      id: workflowId,
      steps: [{ id: stepId, workflowId, ordinal: 0, name: 'Implementer', promptPrefix: '' }],
    });
    render(<RunStepHeading agent={agent} stepAgent={agent} workflow={workflow} />);
    fireEvent.doubleClick(screen.getByText('Step 1 · Implementer'));
    const input = screen.getByRole('textbox', { name: 'Rename agent' });
    fireEvent.change(input, { target: { value: 'Northwind retry fix' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(screen.queryByRole('textbox')).toBeNull());
    const reloaded = (await invokeAgentList(AUTO_SEED_SESSION))[0];
    if (reloaded === undefined) {
      throw new Error('Harborline step did not reload');
    }
    cleanup();
    render(<RunStepHeading agent={reloaded} stepAgent={reloaded} workflow={workflow} />);
    screen.getByText('Step 1 · Implementer · Northwind retry fix');
    expect(await db.select('SELECT name FROM steps WHERE id = ?', [stepId])).toEqual([
      { name: 'Implementer' },
    ]);
  });
});
