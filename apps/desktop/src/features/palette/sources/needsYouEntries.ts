import type { Session, SessionAttentionReason, SessionId, SessionStageInfo } from '@goodboy/types';
import { CONCEPT_ICONS } from '../../../shared/components/conceptIcons';
import { attentionWordsOf } from '../../session/session-stage';
import { attentionMarkOf } from '../../session/attentionMarkOf';
import { sessionTitle } from '../../../shared/utils/sessionTitle';
import type { PaletteEntry } from '../types';

type NeedsYouItem = {
  readonly session: Session;
  readonly info: SessionStageInfo;
};

type SelectParams = {
  readonly sessionId: SessionId;
  readonly attention: SessionAttentionReason | null;
};

type Params = {
  readonly items: ReadonlyArray<NeedsYouItem>;
  readonly open: (params: SelectParams) => void;
};

export const needsYouEntries = ({ items, open }: Params): ReadonlyArray<PaletteEntry> =>
  items.map(({ session, info }): PaletteEntry => {
    const sessionId = session.id as SessionId;
    const { attention } = info;
    return {
      key: `needs:${sessionId}`,
      label: sessionTitle({ session }),
      kind: 'needs',
      group: null,
      icon: CONCEPT_ICONS.sessions,
      ...(attention === null ? {} : { mark: attentionMarkOf({ reason: attention }) }),
      detail:
        attention === null ? info.reason : attentionWordsOf({ reason: attention, counts: info }),
      run: () => open({ sessionId, attention }),
    };
  });
