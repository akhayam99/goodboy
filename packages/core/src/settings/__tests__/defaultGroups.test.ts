import { describe, expect, it } from 'vitest';
import { SELECTABLE_AGENT_ROLES } from '../../roles';
import { DEFAULT_GROUPS } from '../defaultGroups';
import { TASKS } from '../tasks';

describe('DEFAULT_GROUPS', () => {
  it('places every selectable role in exactly one group', () => {
    const grouped = DEFAULT_GROUPS.agents.flatMap((group) => group.members);
    expect([...grouped].sort()).toEqual([...SELECTABLE_AGENT_ROLES].sort());
    expect(new Set(grouped).size).toBe(grouped.length);
  });

  it('places every task in exactly one group', () => {
    const grouped = [
      ...DEFAULT_GROUPS.runs.tasks,
      ...DEFAULT_GROUPS.tasks.flatMap((group) => group.members),
    ];
    expect([...grouped].sort()).toEqual(TASKS.map((task) => task.id).sort());
    expect(new Set(grouped).size).toBe(grouped.length);
  });

  it('keeps the two models a run starts with out of the role and task groups', () => {
    expect(DEFAULT_GROUPS.runs).toEqual({ agents: ['auto'], tasks: ['workflow_orchestrator'] });
    expect(DEFAULT_GROUPS.agents.flatMap((group) => group.members)).not.toContain('auto');
    expect(DEFAULT_GROUPS.tasks.flatMap((group) => group.members)).not.toContain(
      'workflow_orchestrator',
    );
  });
});
