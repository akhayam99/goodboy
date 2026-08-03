import type { Agent, AgentId } from '@goodboy/types';

export type InlineClusterLink = Readonly<{
  title: string;
  instructions: string;
  agent: Agent | null;
}>;

export const selectInlineClusterRuns = (
  phaseRuns: ReadonlyArray<Agent>,
  containerId: AgentId | null,
  defs: ReadonlyArray<{ readonly title: string; readonly instructions: string }>,
): ReadonlyArray<InlineClusterLink> => {
  if (!containerId) {
    return defs.map((d) => ({ title: d.title, instructions: d.instructions, agent: null }));
  }
  const children = phaseRuns
    .filter((r) => r.parentAgentId === containerId && r.kind === 'implementer')
    .sort((a, b) => a.ordinal - b.ordinal);
  return defs.map((d, i) => ({
    title: d.title,
    instructions: d.instructions,
    agent: children[i] ?? null,
  }));
};
