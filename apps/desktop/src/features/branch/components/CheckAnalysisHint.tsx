import type { MountId, PrCheckRun, SessionId } from '@goodboy/types';
import { StartHint } from '../../../shared/components/StartHint';
import { START_HINT_COPY } from '../../../shared/components/startHintCopy';
import { START_HINT_SCOPES } from '../../../store/slices/startHints/startHintScopes';
import { useCheckChain } from '../hooks/useCheckChain';

type Props = {
  readonly sessionId: SessionId;
  readonly mountId: MountId;
  readonly pullRequestUrl: string;
  readonly check: PrCheckRun;
};

export const CheckAnalysisHint = ({ sessionId, mountId, pullRequestUrl, check }: Props) => {
  const url = check.detailsUrl ?? pullRequestUrl;
  const { chain } = useCheckChain({ sessionId, mountId, url });
  if (chain.state !== 'no-fix') {
    return null;
  }
  return (
    <div className="px-2">
      <StartHint
        sessionId={sessionId}
        scope={START_HINT_SCOPES.checkAnalyze({ mountId, url })}
        label={START_HINT_COPY.agentLabel}
        placeholder={START_HINT_COPY.debugger}
      />
    </div>
  );
};
