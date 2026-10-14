import type { Agent, MountId, SessionId } from '@goodboy/types';
import type { AppState } from '../../../store/types';
import { analyzedCheckNameOf } from './analyzedCheckNameOf';

type Params = {
  readonly state: Pick<AppState, 'sessionPhaseRuns' | 'transcripts'>;
  readonly sessionId: SessionId;
  readonly mountId: MountId;
  readonly failingUrl: string | null;
  readonly failingName: string | null;
};

export type CheckTarget = {
  readonly url: string;
  readonly name: string | null;
};

export const checkTargetOf = ({
  state,
  sessionId,
  mountId,
  failingUrl,
  failingName,
}: Params): CheckTarget | null => {
  const analyst = (state.sessionPhaseRuns[sessionId] ?? []).reduce<Agent | null>(
    (latest, agent) =>
      agent.sourceKind !== 'failed_check' ||
      agent.sourceCommentUrl === undefined ||
      agent.mountId !== mountId ||
      agent.parentAgentId !== undefined ||
      agent.deletedAt !== undefined ||
      (latest !== null && latest.ordinal > agent.ordinal)
        ? latest
        : agent,
    null,
  );
  const analyzedUrl = analyst?.sourceCommentUrl;
  if (analyst === null || analyzedUrl === undefined) {
    return failingUrl === null ? null : { url: failingUrl, name: failingName };
  }
  const analyzedName = analyzedCheckNameOf({ events: state.transcripts[analyst.id] ?? [] });
  const isSameCheck =
    failingUrl === null ||
    failingUrl === analyzedUrl ||
    (analyzedName !== null && analyzedName === failingName);
  return isSameCheck
    ? { url: analyzedUrl, name: analyzedName ?? failingName }
    : { url: failingUrl, name: failingName };
};
