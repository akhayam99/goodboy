import { tintClasses } from '@goodboy/ui';
import type { Session, SessionAttentionReason, SessionId, SessionStageInfo } from '@goodboy/types';
import { CONCEPT_ICONS } from '../../../shared/components/conceptIcons';
import { ATTENTION_REASON_META, attentionWordsOf } from '../../session/session-stage';
import { sessionTitle } from '../../session/sessionTitle';
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
    const meta = attention === null ? null : ATTENTION_REASON_META[attention];
    return {
      key: `needs:${sessionId}`,
      label: sessionTitle({ session }),
      kind: 'needs',
      group: null,
      icon: CONCEPT_ICONS[meta?.icon ?? 'sessions'],
      ...(meta === null ? {} : { accent: tintClasses(meta.tone).dot }),
      detail:
        attention === null ? info.reason : attentionWordsOf({ reason: attention, counts: info }),
      run: () => open({ sessionId, attention }),
    };
  });
