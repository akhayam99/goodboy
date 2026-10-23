import type { ReactNode } from 'react';
import { Button } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { RaiseCapPrimary } from '../../components/AgentTree/RunHeader/RaiseCapPrimary';
import { RunPrimaryAction } from '../../components/AgentTree/RunHeader/RunPrimaryAction';
import { useRunView } from '../../components/AgentTree/useRunView';
import { runHeaderPrimaryOf } from '../../components/PresetRun/runHeaderPrimaryOf';
import { runOpenQuestion } from '../../timeline/runOpenQuestion';
import type { LiveRunGroup } from './liveGroupsOf';

type Props = {
  readonly session: Session;
  readonly group: LiveRunGroup;
  readonly fallback: ReactNode;
  readonly isLead: boolean;
};

const QuestionIcon = CONCEPT_ICONS.questions;

export const LiveRunEnd = ({ session, group, fallback, isLead }: Props) => {
  const view = useRunView({ session, run: group.entry.run, workflow: group.entry.workflow });
  const openDrawer = useAppStore((state) => state.openDrawer);
  const variant = isLead ? 'primary' : 'secondary';
  const pageHeader = runHeaderPrimaryOf({ view });
  const entryQuestion = runOpenQuestion({ entry: group.entry })?.question ?? null;
  const header =
    pageHeader.kind === 'live' && entryQuestion !== null
      ? { kind: 'answer' as const, question: entryQuestion }
      : pageHeader;
  switch (header.kind) {
    case 'primary':
      return (
        <RunPrimaryAction
          session={session}
          view={view}
          primary={header.primary}
          variant={variant}
        />
      );
    case 'raiseCap':
      return <RaiseCapPrimary session={session} view={view} variant={variant} />;
    case 'answer':
      return (
        <Button
          size="sm"
          variant={variant}
          data-live-cta="answer"
          onClick={() =>
            openDrawer({
              kind: 'question',
              sessionId: session.id,
              payload: { questionId: header.question.id },
            })
          }
        >
          <QuestionIcon size={ICON_SIZE.control} aria-hidden />
          Answer
        </Button>
      );
    case 'live':
      return fallback;
    default: {
      const exhaustive: never = header;
      return exhaustive;
    }
  }
};
