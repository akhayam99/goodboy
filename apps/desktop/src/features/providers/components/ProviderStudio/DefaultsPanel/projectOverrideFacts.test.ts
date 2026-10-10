// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { WorkspaceId } from '@goodboy/types';
import { EMPTY_OVERRIDES, aProject } from '@goodboy/types/testing';
import { projectOverrideFacts } from './projectOverrideFacts';
import { projectOverrideSentence } from './projectOverrideSentence';

const WORKSPACE_ID = 'workspace-harborline' as WorkspaceId;

describe('projectOverrideFacts', () => {
  it('lists the pool, the default provider and the role count, and skips empty maps', () => {
    const entries = projectOverrideFacts({
      workspaceId: WORKSPACE_ID,
      projects: [
        aProject({
          workspaceId: WORKSPACE_ID,
          name: 'notify-relay',
          overrides: {
            ...EMPTY_OVERRIDES,
            defaultProviderId: 'codex',
            providerPool: [{ id: 'codex', state: 'on' }],
            roleModels: {
              planner: { providerId: 'codex', model: 'gpt-6.1-sol', effort: 'high' },
            },
            taskModels: {},
          },
        }),
        aProject({
          workspaceId: WORKSPACE_ID,
          name: 'ledger-core',
          overrides: { ...EMPTY_OVERRIDES, roleModels: {}, providerPool: [] },
        }),
      ],
    });

    expect(entries.map((entry) => [entry.name, entry.facts])).toEqual([
      ['notify-relay', ['1 role', 'its own provider list', 'Codex as default provider']],
    ]);
  });

  it('keeps at most three facts in the sentence and counts the rest', () => {
    const sentence = projectOverrideSentence({
      entries: [
        {
          projectId: aProject().id,
          name: 'payments-api',
          facts: [
            'orchestrator Sonnet 5',
            'summaries Sonnet 4.5',
            '6 roles',
            'its own provider list',
          ],
        },
      ],
    });

    expect(sentence).toBe(
      'It wins over this page when you work in it: orchestrator Sonnet 5, summaries Sonnet 4.5, 6 roles and 1 more in payments-api.',
    );
  });
});
