import type { GoalAttachment } from '@goodboy/types';
import type { AgentKind } from '../../features/session/agent-kind';

export const ATTACHMENT_KIND_ROUTING: Record<'image' | 'file', ReadonlyArray<AgentKind>> = {
  image: ['planner', 'debugger', 'reviewer', 'generic'],
  file: ['planner', 'implementer', 'debugger', 'generic'],
};

export const kindReadsAttachment = (att: GoalAttachment, kind: AgentKind): boolean => {
  return ATTACHMENT_KIND_ROUTING[att.kind].includes(kind);
};
