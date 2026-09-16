import type { ContextSlot, Session } from '@goodboy/types';
import { formatBriefCount } from './artifactBrief';

export const SESSION_GOAL_LIMITS = {
  chars: 2_000,
} as const;

export const SESSION_GOAL_CLIP_NOTE = `session goal cut at ${formatBriefCount({
  value: SESSION_GOAL_LIMITS.chars,
})} characters`;

export type SessionGoalText = Readonly<{
  text: string;
  isClipped: boolean;
  isDetailed: boolean;
}>;

type Params = Readonly<{
  slots: ReadonlyArray<ContextSlot>;
  session: Pick<Session, 'goal'>;
}>;

export const sessionGoalText = ({ slots, session }: Params): SessionGoalText => {
  const title: SessionGoalText = { text: session.goal, isClipped: false, isDetailed: false };
  const slot = slots.find((entry) => entry.key === 'goal');
  if (slot === undefined || slot.enabled === false) {
    return title;
  }
  const detailed = slot.value.trim();
  if (detailed.length === 0 || detailed === session.goal.trim()) {
    return title;
  }
  if (detailed.length <= SESSION_GOAL_LIMITS.chars) {
    return { text: detailed, isClipped: false, isDetailed: true };
  }
  return {
    text: detailed.slice(0, SESSION_GOAL_LIMITS.chars),
    isClipped: true,
    isDetailed: true,
  };
};
