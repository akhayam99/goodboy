import { PROFILE_ACCESS } from '@goodboy/core';
import type { AgentRole } from '@goodboy/types';
import { ROLE_LABEL } from '../session/agent-kind';

export const GUIDANCE_ROLE_CHOICES: ReadonlyArray<{
  readonly role: AgentRole;
  readonly label: string;
}> = [
  { role: 'scout', label: 'Scout' },
  { role: 'planner', label: 'Planner' },
  { role: 'implementer', label: 'Implementer' },
  { role: 'docs', label: 'Docs' },
  { role: 'tester', label: 'Tester' },
  { role: 'reviewer', label: 'Reviewer' },
];

const labelOf = (role: AgentRole): string =>
  GUIDANCE_ROLE_CHOICES.find((choice) => choice.role === role)?.label ?? role;

export const guidanceRoleNames = ({ roles }: { readonly roles: ReadonlyArray<AgentRole> }) =>
  roles.length === 0 ? 'no role' : roles.map(labelOf).join(', ');

export const guidanceLeftOutText = ({ roles }: { readonly roles: ReadonlyArray<AgentRole> }) => {
  const left = GUIDANCE_ROLE_CHOICES.filter((choice) => !roles.includes(choice.role)).map(
    (choice) => choice.label,
  );
  if (left.length === 0) {
    return 'Every role gets it.';
  }
  return `${left.join(', ')} ${left.length === 1 ? "doesn't" : "don't"} get it, so each keeps its own brief.`;
};

export const sameRoles = ({
  left,
  right,
}: {
  readonly left: ReadonlyArray<AgentRole>;
  readonly right: ReadonlyArray<AgentRole>;
}): boolean => left.length === right.length && left.every((role) => right.includes(role));

export const workingRulesSkippedText = (): string => {
  const skipped = (Object.keys(ROLE_LABEL) as ReadonlyArray<AgentRole>)
    .filter((role) => !PROFILE_ACCESS[role].includes('workingRules'))
    .map((role) => ROLE_LABEL[role]);
  return skipped.length === 0 ? 'every agent' : `every agent but ${skipped.join(', ')}`;
};
