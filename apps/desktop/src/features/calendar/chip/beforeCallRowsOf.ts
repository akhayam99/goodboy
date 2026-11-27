import { inlineMarkdownText, type StatusMarkSpec } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { joinFacts } from '../../../shared/utils/joinFacts';
import { sessionTitle } from '../../../shared/utils/sessionTitle';
import { stageInfoOf, type StageInfoState } from '../../../store/slices/session-view/stageInfoOf';
import { attentionMarkOf } from '../../session/attentionMarkOf';
import { attentionWordsOf } from '../../session/session-stage';
import type { ChipRow } from './callChipTypes';

type Params = {
  readonly state: StageInfoState;
  readonly sessions: ReadonlyArray<Session>;
};

const WAITING: StatusMarkSpec = { kind: 'dot', tone: 'warning' };

export const beforeCallRowsOf = ({ state, sessions }: Params): ReadonlyArray<ChipRow> =>
  sessions.map((session) => {
    const info = stageInfoOf(state, session);
    const { attention } = info;
    const words =
      attention === null ? info.reason : attentionWordsOf({ reason: attention, counts: info });
    const title = inlineMarkdownText({ text: sessionTitle({ session }) }).trim();
    return {
      key: session.id,
      text: joinFacts({ facts: [title, words] }),
      mark: attention === null ? WAITING : attentionMarkOf({ reason: attention }),
      canOpen: true,
    };
  });
