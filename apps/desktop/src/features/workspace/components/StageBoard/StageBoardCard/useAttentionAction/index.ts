import { useMemo } from 'react';
import type { Session, SessionStageInfo } from '@goodboy/types';
import type { Tone } from '@goodboy/ui';
import { useAppStore } from '../../../../../../store';
import { CONCEPT_ICONS } from '../../../../../../shared/components/conceptIcons';
import { attentionPlace } from '../../../../../session/attentionPlace';
import { ATTENTION_REASON_META, attentionWordsOf } from '../../../../../session/session-stage';
import type { DynamicAction } from '../useDynamicActions';

type Params = {
  readonly session: Session;
  readonly info: SessionStageInfo;
};

type ToneParams = {
  readonly tone: Tone;
};

const actionToneOf = ({ tone }: ToneParams): DynamicAction['tone'] => {
  if (tone === 'danger' || tone === 'warning') {
    return tone;
  }
  return 'primary';
};

export const useAttentionAction = ({ session, info }: Params): DynamicAction | null => {
  const navigate = useAppStore((state) => state.navigate);
  const sessionId = session.id;
  const reason = info.stage === 'attention' ? info.attention : null;
  const label = reason === null ? '' : attentionWordsOf({ reason, counts: info });
  return useMemo((): DynamicAction | null => {
    if (reason === null) {
      return null;
    }
    const meta = ATTENTION_REASON_META[reason];
    return {
      key: `attention:${reason}`,
      icon: CONCEPT_ICONS[meta.icon],
      tone: actionToneOf({ tone: meta.tone }),
      label,
      onClick: () =>
        navigate({ to: attentionPlace({ state: useAppStore.getState(), sessionId, reason }) }),
    };
  }, [label, navigate, reason, sessionId]);
};
