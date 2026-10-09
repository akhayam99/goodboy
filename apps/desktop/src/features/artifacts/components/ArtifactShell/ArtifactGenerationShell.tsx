import { useMemo, useRef, useState } from 'react';
import { MetaRow, SectionHeader, Skeleton, cn, PaneShell } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useSessionOpenQuestions } from '../../../../store';
import { formatDateTime } from '../../../../shared/utils/time/formatDateTime';
import { OpenQuestionCluster } from '../../../chat/components/ChatView/OpenQuestionCluster';
import { modelLabel } from '../../../chat/utils/chat-constants';
import { PROVIDER_LABEL } from '../../../providers/providerLabel';
import type { ArtifactGeneration } from '../../artifactCollection';
import { generationStateOf } from '../../artifactStateOf';
import { HeaderConfirm } from '../../../../shared/components/HeaderConfirm';
import type { ArmedAction } from '../../../../shared/components/HeaderConfirm/armedAction';
import { ArtifactScouts } from '../ArtifactStudio/ArtifactScouts';
import { ArtifactShellActions } from './ArtifactShellActions';
import { ArtifactShellHeader } from './ArtifactShellHeader';
import { ArtifactStateChip } from './ArtifactStateChip';

type Props = {
  readonly sessionId: SessionId;
  readonly generation: ArtifactGeneration;
};

const SKELETON_WIDTHS = ['w-2/3', 'w-full', 'w-5/6', 'w-3/4'] as const;

export const ArtifactGenerationShell = ({ sessionId, generation }: Props) => {
  const sessionQuestions = useSessionOpenQuestions(sessionId);
  const questions = useMemo(
    () =>
      sessionQuestions.filter(
        (question) =>
          question.status === 'open' && question.createdByAgentId === generation.agentId,
      ),
    [sessionQuestions, generation.agentId],
  );
  const [armed, setArmed] = useState<ArmedAction | null>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const provider = generation.provider === null ? null : PROVIDER_LABEL[generation.provider];

  return (
    <PaneShell
      header={
        <ArtifactShellHeader
          kind={generation.kind}
          title={generation.title}
          chip={<ArtifactStateChip state={generationStateOf({ generation })} />}
          rootRef={headerRef}
          below={
            <HeaderConfirm armed={armed} triggerWithin={headerRef} onClose={() => setArmed(null)} />
          }
          actions={
            <ArtifactShellActions
              target={{ kind: 'artifact', sessionId, subject: { kind: 'generation', generation } }}
              onArm={setArmed}
              isPrimaryYielding={armed !== null}
            />
          }
          meta={
            <MetaRow
              items={[
                provider === null ? null : <span key="provider">{provider}</span>,
                generation.model === null ? null : (
                  <span key="model">{modelLabel(generation.model, generation.provider)}</span>
                ),
                generation.startedAt === null ? null : (
                  <span key="started" className="tabular-nums">
                    {formatDateTime({ at: generation.startedAt })}
                  </span>
                ),
              ]}
            />
          }
        />
      }
    >
      <div data-testid="artifact-run-detail" className="flex min-w-0 flex-col gap-6">
        {questions.length > 0 ? (
          <div data-testid="artifact-run-questions" className="flex min-w-0 flex-col gap-2">
            <SectionHeader label="Answer this before it can produce" />
            <OpenQuestionCluster questions={questions} sessionId={sessionId} />
          </div>
        ) : null}
        <div className="flex min-w-0 flex-col gap-2">
          <SectionHeader label="Agents on this run" />
          <ArtifactScouts
            sessionId={sessionId}
            agentId={generation.agentId}
            emptyLine="no scout ran for this one, the agent writes it from the session alone"
          />
        </div>
        {generation.state === 'generating' ? (
          <div aria-hidden className="artifact-prose-measure flex flex-col gap-3">
            {SKELETON_WIDTHS.map((width) => (
              <Skeleton key={width} className={cn('h-2.5 rounded-sm', width)} />
            ))}
          </div>
        ) : null}
      </div>
    </PaneShell>
  );
};
