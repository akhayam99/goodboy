import { useMemo } from 'react';
import { MetaRow, SectionHeader, Skeleton, cn } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore, useSessionOpenQuestions } from '../../../../store';
import { PaneShell } from '../../../../shared/components/PaneShell';
import { formatCompactDateTime } from '../../../../shared/utils/formatCompactDateTime';
import { OpenQuestionCluster } from '../../../chat/components/ChatView/OpenQuestionCluster';
import { modelLabel } from '../../../chat/utils/chat-constants';
import { PROVIDER_LABEL } from '../../../providers/providerLabel';
import {
  ARTIFACT_GENERATION_PRESENTATION,
  type ArtifactGeneration,
} from '../../artifactCollection';
import { ArtifactScouts } from '../ArtifactStudio/ArtifactScouts';
import { artifactActions } from './artifactActions';
import { ArtifactShellActions } from './ArtifactShellActions';
import { ArtifactShellHeader } from './ArtifactShellHeader';
import { ArtifactStateChip } from './ArtifactStateChip';

type Props = {
  readonly sessionId: SessionId;
  readonly generation: ArtifactGeneration;
};

const SKELETON_WIDTHS = ['w-2/3', 'w-full', 'w-5/6', 'w-3/4'] as const;

export const ArtifactGenerationShell = ({ sessionId, generation }: Props) => {
  const stopArtifactGeneration = useAppStore((s) => s.stopArtifactGeneration);
  const selectAgent = useAppStore((s) => s.selectAgent);
  const sessionQuestions = useSessionOpenQuestions(sessionId);
  const questions = useMemo(
    () =>
      sessionQuestions.filter(
        (question) =>
          question.status === 'open' && question.createdByAgentId === generation.agentId,
      ),
    [sessionQuestions, generation.agentId],
  );
  const set = artifactActions({ subject: { kind: 'generation', canStop: generation.canStop } });
  const provider = generation.provider === null ? null : PROVIDER_LABEL[generation.provider];

  return (
    <PaneShell
      header={
        <ArtifactShellHeader
          kind={generation.kind}
          title={generation.title}
          chip={
            <ArtifactStateChip
              presentation={ARTIFACT_GENERATION_PRESENTATION[generation.kind][generation.state]}
            />
          }
          actions={
            <ArtifactShellActions
              set={set}
              handles={{
                stop: {
                  onClick: () =>
                    void stopArtifactGeneration({ sessionId, agentId: generation.agentId }),
                },
                openAgent: { onClick: () => void selectAgent(sessionId, generation.agentId) },
              }}
            />
          }
          toggles={null}
          meta={
            <MetaRow
              items={[
                provider === null ? null : <span key="provider">{provider}</span>,
                generation.model === null ? null : (
                  <span key="model">{modelLabel(generation.model)}</span>
                ),
                generation.startedAt === null ? null : (
                  <span key="started" className="tabular-nums">
                    {formatCompactDateTime({ iso: generation.startedAt })}
                  </span>
                ),
              ]}
            />
          }
        />
      }
    >
      <div data-testid="artifact-run-detail" className="flex min-w-0 flex-col gap-5">
        {questions.length > 0 ? (
          <div data-testid="artifact-run-questions" className="flex min-w-0 flex-col gap-2">
            <SectionHeader label="Answer this before it can produce" />
            <OpenQuestionCluster
              questions={questions}
              sessionId={sessionId}
              viewerAgentId={generation.agentId}
            />
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
          <div aria-hidden className="artifact-prose-measure flex flex-col gap-2.5">
            {SKELETON_WIDTHS.map((width) => (
              <Skeleton key={width} className={cn('h-2.5 rounded-sm', width)} />
            ))}
          </div>
        ) : null}
      </div>
    </PaneShell>
  );
};
