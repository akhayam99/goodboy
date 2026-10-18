import { describe, expect, it } from 'vitest';
import { SELECTABLE_AGENT_ROLES } from '../../roles';
import { TASKS } from '../../settings/tasks';
import { RUNGS } from './effortLadder';
import { rungForStep, SLOT_RUNGS } from './slotRungs';

const ROLE_IDS = [...SELECTABLE_AGENT_ROLES];

const TASK_IDS = TASKS.map((task) => task.id);

const indexOf = (rung: (typeof RUNGS)[number]): number => RUNGS.indexOf(rung);

describe('SLOT_RUNGS', () => {
  it('names a rung for every role and every background task', () => {
    for (const slot of [...ROLE_IDS, ...TASK_IDS]) {
      expect(SLOT_RUNGS[slot], slot).toBeDefined();
    }
  });

  it('moves a role at most one rung from its normal rung', () => {
    for (const slot of [...ROLE_IDS, ...TASK_IDS]) {
      const { small, normal, large } = SLOT_RUNGS[slot];
      expect(indexOf(normal) - indexOf(small), `${slot} small`).toBeGreaterThanOrEqual(0);
      expect(indexOf(normal) - indexOf(small), `${slot} small`).toBeLessThanOrEqual(1);
      expect(indexOf(large) - indexOf(normal), `${slot} large`).toBeGreaterThanOrEqual(0);
      expect(indexOf(large) - indexOf(normal), `${slot} large`).toBeLessThanOrEqual(1);
    }
  });

  it('never puts an agent role on the quick rung', () => {
    for (const role of ROLE_IDS) {
      expect(SLOT_RUNGS[role].small, role).not.toBe('quick');
    }
  });

  it('keeps the planner on Hard or Top', () => {
    expect(SLOT_RUNGS.planner.small).toBe('hard');
    expect(SLOT_RUNGS.planner.normal).toBe('top');
  });

  it('keeps a background task on one rung whatever the size of the step', () => {
    for (const task of TASK_IDS) {
      const { small, normal, large } = SLOT_RUNGS[task];
      expect([small, large], task).toEqual([normal, normal]);
    }
  });

  it('puts the five writing jobs on quick, re-checks and Scribe on light', () => {
    for (const task of [
      'summarizer',
      'learnings',
      'prose_polish',
      'agent_naming',
      'issue_brief',
    ] as const) {
      expect(SLOT_RUNGS[task].normal, task).toBe('quick');
    }
    expect(SLOT_RUNGS.recheck.normal).toBe('light');
    expect(SLOT_RUNGS.pr_draft.normal).toBe('light');
    expect(SLOT_RUNGS.workflow_orchestrator.normal).toBe('standard');
  });
});

describe('rungForStep', () => {
  it('reads the normal rung without a size and the moved rung with one', () => {
    expect(rungForStep({ slot: 'implementer' })).toBe('standard');
    expect(rungForStep({ slot: 'implementer', size: null })).toBe('standard');
    expect(rungForStep({ slot: 'implementer', size: 'medium' })).toBe('standard');
    expect(rungForStep({ slot: 'implementer', size: 'small' })).toBe('light');
    expect(rungForStep({ slot: 'implementer', size: 'large' })).toBe('hard');
    expect(rungForStep({ slot: 'investigator', size: 'large' })).toBe('top');
  });
});
