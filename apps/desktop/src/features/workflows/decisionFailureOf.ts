import { ORCHESTRATED_COPY } from './orchestratedCopy';
import { modelNamesIn } from './modelNamesIn';
import type { OrchestratorState } from './orchestratorState';

type Params = {
  readonly orchestrator: Pick<OrchestratorState, 'phase' | 'detail'>;
};

export const decisionFailureOf = ({ orchestrator }: Params): string | null => {
  if (orchestrator.phase !== 'failed') {
    return null;
  }
  const detail = orchestrator.detail?.trim() ?? '';
  return detail === '' ? ORCHESTRATED_COPY.noFailureReason : modelNamesIn({ text: detail });
};
