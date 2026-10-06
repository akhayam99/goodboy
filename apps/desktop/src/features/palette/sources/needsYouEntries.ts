import type { Session, SessionAttentionReason, SessionId } from '@goodboy/types';
import { CONCEPT_ICONS } from '../../../shared/components/conceptIcons';
import { ATTENTION_REASON_META } from '../../session/session-stage';
import { sessionTitle } from '../../session/sessionTitle';
import type { PaletteEntry } from '../types';

type NeedsYouItem = {
  readonly session: Session;
  readonly reason: string;
  readonly attention: SessionAttentionReason | null;
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
  items.map(({ session, reason, attention }): PaletteEntry => {
    const sessionId = session.id as SessionId;
    const meta = attention === null ? null : ATTENTION_REASON_META[attention];
    return {
      key: `needs:${sessionId}`,
      label: sessionTitle({ session }),
      kind: 'needs',
      group: null,
      icon: CONCEPT_ICONS[meta?.icon ?? 'sessions'],
      detail: reason,
      run: () => open({ sessionId, attention }),
    };
  });
