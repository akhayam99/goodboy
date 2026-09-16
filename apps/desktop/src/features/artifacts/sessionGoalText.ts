import type { ContextSlot, Session } from '@goodboy/types';
import { redactSecrets } from '../../shared/utils/redactSecrets';
import { formatBriefCount } from './artifactBrief';

export const SESSION_GOAL_LIMITS = {
  chars: 2_000,
} as const;

export const SESSION_GOAL_CLIP_NOTE = `session goal cut at ${formatBriefCount({
  value: SESSION_GOAL_LIMITS.chars,
})} characters`;

export type SessionGoalText = Readonly<{
  editorText: string;
  packText: string;
  isClipped: boolean;
  isDetailed: boolean;
}>;

type Params = Readonly<{
  slots: ReadonlyArray<ContextSlot>;
  session: Pick<Session, 'goal'>;
}>;

type PackParams = Readonly<{
  text: string;
}>;

const packValue = ({ text }: PackParams): Pick<SessionGoalText, 'packText' | 'isClipped'> => {
  const redacted = redactSecrets({ text });
  if (redacted.length <= SESSION_GOAL_LIMITS.chars) {
    return { packText: redacted, isClipped: false };
  }
  return { packText: redacted.slice(0, SESSION_GOAL_LIMITS.chars), isClipped: true };
};

export const sessionGoalText = ({ slots, session }: Params): SessionGoalText => {
  const title: SessionGoalText = {
    editorText: session.goal,
    ...packValue({ text: session.goal }),
    isDetailed: false,
  };
  const slot = slots.find((entry) => entry.key === 'goal');
  if (slot === undefined || slot.enabled === false) {
    return title;
  }
  const detailed = slot.value.trim();
  if (detailed.length === 0 || detailed === session.goal.trim()) {
    return title;
  }
  return {
    editorText: detailed,
    ...packValue({ text: detailed }),
    isDetailed: true,
  };
};
