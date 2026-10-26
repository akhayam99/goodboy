import { inlineMarkdownText } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { attentionWordsOf } from '../../session/session-stage';
import { sessionTitle } from '../../../shared/utils/sessionTitle';
import { stageInfoOf, type StageInfoState } from '../../../store/slices/session-view/stageInfoOf';
import type { BannerCandidate } from './awayBannersOf';
import { blockingReasonsOf } from './blockingReasonsOf';

type Params = {
  readonly state: StageInfoState;
  readonly sessions: ReadonlyArray<Session>;
};

export const bannerCandidatesOf = ({ state, sessions }: Params): ReadonlyArray<BannerCandidate> =>
  sessions.flatMap((session) => {
    const info = stageInfoOf(state, session);
    const title = inlineMarkdownText({ text: sessionTitle({ session }) }).trim();
    return blockingReasonsOf({ info }).map((reason) => ({
      key: `${session.id}:${reason}`,
      sessionId: session.id,
      reason,
      title,
      body: attentionWordsOf({ reason, counts: info }),
    }));
  });
