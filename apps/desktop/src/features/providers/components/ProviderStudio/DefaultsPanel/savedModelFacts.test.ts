// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { aProject, aWorkspace } from '@goodboy/types/testing';
import { savedModelFacts } from './savedModelFacts';

const WORKSPACE_ID = aWorkspace({ name: 'Harborline' }).id;
const OTHER_WORKSPACE_ID = aWorkspace({ name: 'Northwind' }).id;

const NOTIFY_RELAY = aProject({ workspaceId: WORKSPACE_ID, name: 'notify-relay' });
const LEDGER_CORE = aProject({ workspaceId: WORKSPACE_ID, name: 'ledger-core' });
const PAYMENTS_API = aProject({ workspaceId: OTHER_WORKSPACE_ID, name: 'payments-api' });

describe('savedModelFacts', () => {
  it('lists the task and the role count of a project that had both', () => {
    const entries = savedModelFacts({
      workspaceId: WORKSPACE_ID,
      projects: [NOTIFY_RELAY],
      saved: {
        [NOTIFY_RELAY.id]: {
          taskModels: {
            workflow_orchestrator: { providerId: 'anthropic', model: 'claude-sonnet-5' },
          },
          roleModels: {
            planner: { providerId: 'codex', model: 'gpt-6.1-sol', effort: 'high' },
          },
        },
      },
    });

    expect(entries.map((entry) => [entry.name, entry.facts])).toEqual([
      ['notify-relay', ['orchestrator Sonnet 5', '1 role']],
    ]);
  });

  it('skips a project of another workspace and one with nothing saved', () => {
    const entries = savedModelFacts({
      workspaceId: WORKSPACE_ID,
      projects: [NOTIFY_RELAY, LEDGER_CORE, PAYMENTS_API],
      saved: {
        [PAYMENTS_API.id]: {
          taskModels: { summarizer: { providerId: 'anthropic', model: 'claude-sonnet-5' } },
          roleModels: null,
        },
        [LEDGER_CORE.id]: { taskModels: null, roleModels: null },
      },
    });

    expect(entries).toEqual([]);
  });

  it('keeps the order of the project list', () => {
    const models = {
      taskModels: null,
      roleModels: { planner: { providerId: 'codex', model: 'gpt-6.1-sol', effort: 'high' } },
    } as const;
    const entries = savedModelFacts({
      workspaceId: WORKSPACE_ID,
      projects: [LEDGER_CORE, NOTIFY_RELAY],
      saved: { [NOTIFY_RELAY.id]: models, [LEDGER_CORE.id]: models },
    });

    expect(entries.map((entry) => entry.name)).toEqual(['ledger-core', 'notify-relay']);
  });
});
