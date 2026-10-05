import { PROVIDER_IDS, type ResolveCommitStyle, type ResolveLaunchChoice } from '@goodboy/types';
import { EFFORT_LEVELS } from '../chat/utils/chat-constants';
import type { ResolveModelChoice } from '../chat/spawn-from-comment';
import type { AgentKindRouting } from '../session/agent-kind';

type LaunchParams = {
  readonly routing: AgentKindRouting;
  readonly commitStyle: ResolveCommitStyle | null;
  readonly hint: string | null;
};

export const launchChoiceOf = ({
  routing,
  commitStyle,
  hint,
}: LaunchParams): ResolveLaunchChoice => {
  const trimmed = hint?.trim() ?? '';
  return {
    provider: routing.provider,
    model: routing.model,
    effort: routing.effort ?? null,
    commitStyle,
    hint: trimmed.length === 0 ? null : trimmed,
  };
};

export const modelChoiceOfLaunch = ({
  launchChoice,
}: {
  readonly launchChoice: ResolveLaunchChoice;
}): ResolveModelChoice => {
  const provider = PROVIDER_IDS.find((id) => id === launchChoice.provider);
  const effort = EFFORT_LEVELS.find((level) => level === launchChoice.effort);
  return {
    ...(provider !== undefined && { provider }),
    ...(launchChoice.model !== null && { model: launchChoice.model }),
    ...(effort !== undefined && { effort }),
    ...(launchChoice.hint !== null && { hint: launchChoice.hint }),
  };
};
