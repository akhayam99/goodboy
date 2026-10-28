import { Button, ICON_SIZE } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { useAnswerQuestion } from '../../../workflows/useAnswerQuestion';
import type { WorkflowRunActionTarget } from '../../../actions/types';
import { RaiseCapPrimary } from '../AgentTree/RunHeader/RaiseCapPrimary';
import { RunPrimaryAction } from '../AgentTree/RunHeader/RunPrimaryAction';
import type { RunView } from '../AgentTree/useRunView';
import type { RunHeaderPrimary as RunHeaderPrimaryModel } from './runHeaderPrimaryOf';
import { RunLiveVerbs } from './RunLiveVerbs';

type Props = {
  readonly session: Session;
  readonly view: RunView;
  readonly target: WorkflowRunActionTarget;
  readonly header: RunHeaderPrimaryModel;
};

const QuestionIcon = CONCEPT_ICONS.questions;

export const RunHeaderPrimary = ({ session, view, target, header }: Props) => {
  const answer = useAnswerQuestion({ sessionId: session.id });
  switch (header.kind) {
    case 'primary':
      return <RunPrimaryAction session={session} view={view} primary={header.primary} />;
    case 'raiseCap':
      return <RaiseCapPrimary session={session} view={view} variant="primary" />;
    case 'answer':
      return (
        <Button size="sm" variant="secondary" onClick={() => answer({ question: header.question })}>
          <QuestionIcon size={ICON_SIZE.control} aria-hidden />
          Open question
        </Button>
      );
    case 'live':
      return <RunLiveVerbs target={target} />;
    default: {
      const exhaustive: never = header;
      return exhaustive;
    }
  }
};
