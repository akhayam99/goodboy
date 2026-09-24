import { describe, expect, it } from 'vitest';
import { buildOrchestratorUserPrompt, ORCHESTRATOR_SYSTEM_PROMPT } from './prompt';
import type { OrchestratorInput, OrchestratorNeedRequest } from './types';

const input = (overrides: Partial<OrchestratorInput> = {}): OrchestratorInput => ({
  goal: 'Ship the change',
  processText: 'Inspect, implement, test.',
  completedSteps: [],
  openQuestionCount: 0,
  providerId: 'anthropic',
  modelMenu: [],
  roleDefaults: [],
  stepsUsed: 0,
  ...overrides,
});

const request = (overrides: Partial<OrchestratorNeedRequest> = {}): OrchestratorNeedRequest => ({
  obligationId: 'capability-obligation:agent-1:scout:discovery',
  requesterName: 'Plan the migration',
  requesterRole: 'planner',
  targetRole: 'scout',
  purpose: 'discovery',
  question: 'Which modules read the legacy column?',
  gap: 'The inventory lists no caller map.',
  scope: ['packages/db'],
  expectedOutput: 'A list of files that read it.',
  continuation: 'resume',
  evidenceRefs: ['artifact:plan-3'],
  inventoryRevision: 'rev-9',
  ...overrides,
});

describe('the need decision contract', () => {
  it('names every disposition in the system prompt', () => {
    expect(ORCHESTRATOR_SYSTEM_PROMPT).toContain('"action":"need"');
    ['grant:', 'reuse:', 'attach:', 'refine:', 'refuse:'].forEach((marker) => {
      expect(ORCHESTRATOR_SYSTEM_PROMPT).toContain(marker);
    });
  });

  it('keeps the deterministic checks out of the orchestrator judgement', () => {
    expect(ORCHESTRATOR_SYSTEM_PROMPT).toContain('The runtime already checks');
    expect(ORCHESTRATOR_SYSTEM_PROMPT).toContain('one obligation has one owner');
  });

  it('tells the orchestrator not to make an implementer delegate what it can fix', () => {
    expect(ORCHESTRATOR_SYSTEM_PROMPT).toContain(
      'Do not make an implementer delegate what it can already fix inside its own scope',
    );
  });

  it('says a replan grant freezes the running plan and is adopted whole or not at all', () => {
    expect(ORCHESTRATOR_SYSTEM_PROMPT).toContain('freezes the plan in flight');
    expect(ORCHESTRATOR_SYSTEM_PROMPT).toContain('adopts it as a whole or refuses it as a whole');
  });
});

describe('buildOrchestratorUserPrompt with a pending need', () => {
  it('delivers the exact validated request', () => {
    const prompt = buildOrchestratorUserPrompt(input({ pendingRequest: request() }));
    expect(prompt).toContain('Pending capability need');
    expect(prompt).toContain('obligationId: capability-obligation:agent-1:scout:discovery');
    expect(prompt).toContain('requested: scout for discovery');
    expect(prompt).toContain('Which modules read the legacy column?');
    expect(prompt).toContain('gap: The inventory lists no caller map.');
    expect(prompt).toContain('requested continuation: resume');
    expect(prompt).toContain('inventory revision: rev-9');
    expect(prompt).toContain('Return the marked need decision now.');
  });

  it('delivers evidence in full rather than previewed', () => {
    const detail = 'x'.repeat(600);
    const prompt = buildOrchestratorUserPrompt(
      input({
        pendingRequest: request(),
        evidenceExcerpts: [
          {
            sourceId: 'artifact:plan-3',
            kind: 'artifact',
            label: 'Migration plan',
            provenance: 'plan artifact',
            revision: 'rev-9',
            availability: 'delivered',
            detail,
          },
        ],
      }),
    );
    expect(prompt).toContain('never previewed');
    expect(prompt).toContain(detail);
  });

  it('lists unresolved obligations with their owners and the allowances left', () => {
    const prompt = buildOrchestratorUserPrompt(
      input({
        pendingRequest: request(),
        graphRevision: 'graph-2',
        unresolvedObligations: [
          {
            obligationId: 'obl-7',
            identity: 'agent-2:implementer:repair',
            targetRole: 'implementer',
            purpose: 'repair',
            state: 'granted',
            ownerName: 'Repair the parser',
          },
        ],
        allowances: {
          generationRemaining: 4,
          repairAttemptsRemaining: 1,
          structuralReplansRemaining: 0,
          spendRemainingUsd: 3.5,
        },
      }),
    );
    expect(prompt).toContain('Active graph revision: graph-2');
    expect(prompt).toContain('owner Repair the parser');
    expect(prompt).toContain('generated agents left: 4');
    expect(prompt).toContain('structural replans left in this run: 0');
    expect(prompt).toContain('spend left: $3.50');
  });

  it('leaves the need sections out when nothing is pending', () => {
    const prompt = buildOrchestratorUserPrompt(input());
    expect(prompt).not.toContain('Pending capability need');
    expect(prompt).toContain('Return the marked decision now.');
  });
});
