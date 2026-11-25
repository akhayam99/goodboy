import { describe, expect, it } from 'vitest';
import { brandId, type AgentId, type AutoTreeId, type SessionId } from '@goodboy/types';
import { WORKFLOW_LIBRARY } from '../workflows/library';
import { diagnoseAdmission, type AdmissionSnapshot } from './admission';
import { parseAutoBlock, parseAutoNoteBlocks } from './autoBlock';
import {
  GUIDE_SECTION_CHARS,
  continuedGuide,
  deviatedGuide,
  followedGuide,
  guideGateOf,
  guideSectionOf,
  heldGuide,
  parseGuideRecord,
  serializeGuideRecord,
  startGuideRecord,
  type GuideRecord,
} from './guideSpec';
import { LEAD_PERMISSION_PRESETS } from './permissions';
import { buildAutoSystemPrompt } from './prompt';

const NOW = 1_700_000_000_000;
const ROOT = brandId<AgentId>({ value: 'agent-auto-root' });

type RecordParams = {
  readonly slug: string;
  readonly isUnderway?: boolean;
};

const recordOf = ({ slug, isUnderway = false }: RecordParams): GuideRecord => {
  const entry = WORKFLOW_LIBRARY.find((candidate) => candidate.slug === slug);
  if (entry === undefined) {
    throw new Error(`no built in ${slug}`);
  }
  const choices = WORKFLOW_LIBRARY.filter((candidate) => candidate.slug !== slug).map(
    (candidate) => ({ id: candidate.slug, name: candidate.name }),
  );
  return startGuideRecord({
    workflowId: entry.slug,
    name: entry.name,
    entryCheck: entry.entryCheck,
    stopRule: entry.stopRule,
    suggestion: choices.find((choice) => choice.id === entry.thenSuggestSlug) ?? null,
    isOrderKept: false,
    steps: entry.steps.map((step) => ({ name: step.name, role: step.role })),
    choices,
    isUnderway,
  });
};

describe('startGuideRecord', () => {
  it('waits for the first check on a workflow that has one', () => {
    expect(recordOf({ slug: 'fix-a-bug' }).check).toBe('pending');
  });

  it('starts passed when the run is already underway', () => {
    expect(recordOf({ slug: 'fix-a-bug', isUnderway: true }).check).toBe('passed');
  });

  it('starts passed when the workflow has no check and no stop rule', () => {
    const guide = startGuideRecord({
      workflowId: 'wf-harborline',
      name: 'Harborline release',
      entryCheck: '',
      stopRule: '  ',
      suggestion: null,
      isOrderKept: true,
      steps: [],
      choices: [],
      isUnderway: false,
    });

    expect(guide.check).toBe('passed');
  });

  it('round trips through its stored text', () => {
    const held = heldGuide({
      guide: recordOf({ slug: 'fix-a-bug' }),
      reason: 'It works as designed.',
      suggest: 'plan and ship',
    });

    expect(parseGuideRecord({ raw: serializeGuideRecord({ guide: held }) })).toEqual(held);
  });

  it('reads nothing from a broken record', () => {
    expect(parseGuideRecord({ raw: null })).toBeNull();
    expect(parseGuideRecord({ raw: '{' })).toBeNull();
    expect(parseGuideRecord({ raw: '{"workflowId":"a","name":"b","check":"nope"}' })).toBeNull();
  });
});

describe('guide transitions', () => {
  const pending = recordOf({ slug: 'fix-a-bug' });

  it('passes the check once and keeps the first note', () => {
    const passed = followedGuide({ guide: pending, note: 'Reproduced in two runs.' });

    expect(passed.check).toBe('passed');
    expect(followedGuide({ guide: passed, note: 'Again.' }).checkNote).toBe(
      'Reproduced in two runs.',
    );
  });

  it('holds with a suggestion named in the list and with none outside it', () => {
    expect(
      heldGuide({ guide: pending, reason: 'r', suggest: 'Plan and ship' }).holdSuggestion,
    ).toEqual({
      id: 'plan-and-ship',
      name: 'Plan and ship',
    });
    expect(
      heldGuide({ guide: pending, reason: 'r', suggest: 'Cook dinner' }).holdSuggestion,
    ).toBeNull();
  });

  it('lifts a hold into continued and leaves other states alone', () => {
    const held = heldGuide({ guide: pending, reason: 'r', suggest: null });

    expect(continuedGuide({ guide: held }).check).toBe('continued');
    expect(continuedGuide({ guide: pending })).toBe(pending);
  });

  it('records a deviation once', () => {
    const deviation = {
      change: 'skipped',
      step: 'Investigate',
      reason: 'Findings carried over.',
    } as const;
    const once = deviatedGuide({ guide: pending, deviation });

    expect(once.deviations).toEqual([deviation]);
    expect(deviatedGuide({ guide: once, deviation })).toBe(once);
  });
});

describe('guideGateOf', () => {
  const pending = recordOf({ slug: 'fix-a-bug' });

  it('refuses a writer before the check is reported and names its slot', () => {
    expect(guideGateOf({ guide: pending, roles: ['scout', 'implementer'] })).toEqual({
      code: 'check_pending',
      slots: [1],
    });
  });

  it('lets readers through before the check', () => {
    expect(guideGateOf({ guide: pending, roles: ['scout', 'investigator'] })).toBeNull();
  });

  it('lets a writer through after follow', () => {
    const passed = followedGuide({ guide: pending, note: 'ok' });

    expect(guideGateOf({ guide: passed, roles: ['implementer'] })).toBeNull();
  });

  it('refuses every role after a hold, readers included', () => {
    const held = heldGuide({ guide: pending, reason: 'r', suggest: null });

    expect(guideGateOf({ guide: held, roles: ['scout'] })?.code).toBe('held');
  });

  it('lets work through once the user continued', () => {
    const held = heldGuide({ guide: pending, reason: 'r', suggest: null });

    expect(
      guideGateOf({ guide: continuedGuide({ guide: held }), roles: ['implementer'] }),
    ).toBeNull();
  });

  it('gates nothing for a run without a workflow', () => {
    expect(guideGateOf({ guide: null, roles: ['implementer'] })).toBeNull();
  });
});

describe('diagnoseAdmission with a guide', () => {
  const pending = recordOf({ slug: 'fix-a-bug' });

  const snapshotOf = (guide: GuideRecord | null): AdmissionSnapshot => ({
    tree: {
      id: brandId<AutoTreeId>({ value: 'tree-1' }),
      rootAgentId: ROOT,
      sessionId: brandId<SessionId>({ value: 'session-harborline' }),
      primaryMountId: 'mount-ledger-core',
      generation: 1,
      phase: 'deciding',
      phaseRev: 3,
      blockedReason: null,
      activeRunId: 'run-1',
      activeDeliveryId: null,
      isYieldRequested: false,
      stopState: 'none',
      capUsd: 5,
      turnsUsed: 1,
      delegationsUsed: 0,
      attemptsUsed: 0,
      noProgressStreak: 0,
      questionCycles: 0,
      grants: 0,
      createdAt: NOW,
      updatedAt: NOW,
      schedulerOwner: 'window-a',
      ownerLeaseExpiresAt: NOW + 30_000,
    },
    ownerId: 'window-a',
    nowMs: NOW,
    callerAgentId: ROOT,
    expectedGeneration: 1,
    expectedRunId: 'run-1',
    openChildAgentIds: [],
    remainingUsd: 5,
    artifacts: [],
    isPlanApprovalRequired: false,
    permissions: LEAD_PERMISSION_PRESETS.run,
    guide,
  });

  const child = (role: 'scout' | 'implementer') => ({
    childAgentId: `agent-${role}`,
    role,
    reviseOf: null,
    inputArtifacts: [],
  });

  it('refuses a writer while the check is pending', () => {
    const verdict = diagnoseAdmission({
      snapshot: snapshotOf(pending),
      children: [child('implementer')],
    });

    expect(verdict).toMatchObject({ kind: 'refused', code: 'check_pending' });
  });

  it('accepts a writer after follow', () => {
    const verdict = diagnoseAdmission({
      snapshot: snapshotOf(followedGuide({ guide: pending, note: 'ok' })),
      children: [child('implementer')],
    });

    expect(verdict.kind).toBe('ok');
  });

  it('refuses a scout after a hold', () => {
    const verdict = diagnoseAdmission({
      snapshot: snapshotOf(heldGuide({ guide: pending, reason: 'r', suggest: null })),
      children: [child('scout')],
    });

    expect(verdict).toMatchObject({ kind: 'refused', code: 'held' });
  });

  it('is unchanged without a guide', () => {
    expect(
      diagnoseAdmission({ snapshot: snapshotOf(null), children: [child('implementer')] }).kind,
    ).toBe('ok');
  });
});

describe('block parsing', () => {
  it('reads follow, hold and deviate', () => {
    expect(
      parseAutoBlock({
        text: '<<auto>>{"action":"follow","check":"Failing test written."}<</auto>>',
      }),
    ).toEqual({ kind: 'block', block: { action: 'follow', check: 'Failing test written.' } });
    expect(
      parseAutoBlock({
        text: '<<auto>>{"action":"hold","reason":"Works as designed.","suggest":"Plan and ship"}<</auto>>',
      }),
    ).toEqual({
      kind: 'block',
      block: { action: 'hold', reason: 'Works as designed.', suggest: 'Plan and ship' },
    });
    expect(
      parseAutoBlock({
        text: '<<auto>>{"action":"deviate","change":"added","step":"Review","reason":"Touches ledger-core."}<</auto>>',
      }),
    ).toEqual({
      kind: 'block',
      block: { action: 'deviate', change: 'added', step: 'Review', reason: 'Touches ledger-core.' },
    });
  });

  it('refuses a hold without a reason and a deviate with an unknown change', () => {
    expect(parseAutoBlock({ text: '<<auto>>{"action":"hold"}<</auto>>' }).kind).toBe('invalid');
    expect(
      parseAutoBlock({
        text: '<<auto>>{"action":"deviate","change":"renamed","step":"a","reason":"b"}<</auto>>',
      }).kind,
    ).toBe('invalid');
  });

  it('reads follow and deviate written before the last block', () => {
    const text = [
      '<<auto>>{"action":"follow","check":"Reproduced."}<</auto>>',
      '<<auto>>{"action":"deviate","change":"skipped","step":"Scout","reason":"Not needed."}<</auto>>',
      '<<auto>>{"action":"finish","summary":"Done."}<</auto>>',
    ].join('\n');

    expect(parseAutoNoteBlocks({ text }).map((outcome) => outcome.kind)).toEqual([
      'block',
      'block',
    ]);
    expect(parseAutoBlock({ text })).toMatchObject({ block: { action: 'finish' } });
  });
});

describe('the workflow section of the prompt', () => {
  const slugs = WORKFLOW_LIBRARY.map((entry) => entry.slug);

  it.each(slugs)('names the %s workflow, its check, stop rule and steps', (slug) => {
    const entry = WORKFLOW_LIBRARY.find((candidate) => candidate.slug === slug);
    const section = guideSectionOf({ guide: recordOf({ slug }) });

    expect(section).toContain(`You follow the workflow "${entry?.name}".`);
    expect(section).toContain(`First, check: ${entry?.entryCheck}`);
    expect(section).toContain(`Stop and ask when: ${entry?.stopRule}`);
    expect(section).toContain('Usual steps:');
    expect(section.length).toBeLessThan(GUIDE_SECTION_CHARS);
  });

  it('says what the Lead does next in each state', () => {
    const pending = recordOf({ slug: 'fix-a-bug' });

    expect(guideSectionOf({ guide: pending })).toContain('writers are refused');
    expect(guideSectionOf({ guide: followedGuide({ guide: pending, note: 'ok' }) })).toContain(
      'The first check passed.',
    );
    expect(
      guideSectionOf({ guide: heldGuide({ guide: pending, reason: 'r', suggest: null }) }),
    ).toContain('Start nothing until the user answers.');
  });

  it('changes nothing in the prompt of a run without a workflow', () => {
    const base = buildAutoSystemPrompt({ isDelegationEnabled: true });

    expect(buildAutoSystemPrompt({ isDelegationEnabled: true, guide: null })).toBe(base);
    expect(base).not.toContain('WORKFLOW FOR THIS RUN');
  });

  it('adds only the section when a workflow is followed', () => {
    const guide = recordOf({ slug: 'fix-a-bug' });
    const base = buildAutoSystemPrompt({ isDelegationEnabled: true });
    const guided = buildAutoSystemPrompt({ isDelegationEnabled: true, guide });

    expect(guided.replace(`${guideSectionOf({ guide })}\n\n`, '')).toBe(base);
  });

  it.each(['Balanced', 'In order', 'most room', 'Send new steps to'])(
    'never says %s, since routing is not its job',
    (word) => {
      const guide = recordOf({ slug: 'fix-a-bug' });
      const states = [
        guide,
        followedGuide({ guide, note: 'ok' }),
        heldGuide({ guide, reason: 'r', suggest: null }),
      ];

      for (const state of states) {
        expect(guideSectionOf({ guide: state })).not.toContain(word);
      }
    },
  );
});
