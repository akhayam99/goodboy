import type { Agent, Session } from '@goodboy/types';
import { Button } from '@goodboy/ui';
import { NAMES } from '../../../../../../shared/utils/names';
import { useAppStore } from '../../../../../../store';
import type { SessionRunVerb } from '../../../../sessionRunsOf';
import { RunContinueVerb } from './RunContinueVerb';

type Props = {
  readonly session: Session;
  readonly verb: SessionRunVerb;
  readonly isBusy: boolean;
  readonly onPress: () => void;
};

const NO_AGENTS: ReadonlyArray<Agent> = [];

const LABEL = {
  continue: NAMES.continue,
  continueRun: NAMES.continue,
  start: NAMES.start,
  startRun: NAMES.start,
} as const satisfies Record<SessionRunVerb['kind'], string>;

export const RunRowVerb = ({ session, verb, isBusy, onPress }: Props) => {
  const agent = useAppStore((state) =>
    verb.kind === 'continue'
      ? ((state.sessionPhaseRuns[session.id] ?? NO_AGENTS).find(
          (candidate) => candidate.id === verb.agentId,
        ) ?? null)
      : null,
  );
  if (agent !== null) {
    return <RunContinueVerb session={session} agent={agent} isBusy={isBusy} onPress={onPress} />;
  }
  return (
    <Button variant="quiet" size="xs" isBusy={isBusy} onClick={onPress}>
      {LABEL[verb.kind]}
    </Button>
  );
};
