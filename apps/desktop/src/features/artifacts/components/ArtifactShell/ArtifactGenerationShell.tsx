import { useMemo } from 'react';
import { MetaRow, SectionHeader, Skeleton, cn, PaneShell } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useSessionOpenQuestions } from '../../../../store';
import { formatDateTime } from '../../../../shared/utils/time/formatDateTime';
import { RelativeTime } from '../../../../shared/components/RelativeTime';
import { ProviderGlyph } from '../../../../shared/components/RoutingPicker/ProviderGlyph';
import { OpenQuestionCluster } from '../../../chat/components/ChatView/OpenQuestionCluster';
import { modelLabel } from '../../../chat/utils/chat-constants';
import type { ArtifactGeneration } from '../../artifactCollection';
import { ArtifactScouts } from '../ArtifactStudio/ArtifactScouts';
import { ArtifactShellActions } from './ArtifactShellActions';
import { ArtifactShellHeader } from './ArtifactShellHeader';

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

  return (
    <PaneShell
      page={generation.kind}
      header={
        <ArtifactShellHeader
          kind={generation.kind}
          title={generation.title}
          chip={null}
          actions={
            <ArtifactShellActions
              target={{ kind: 'artifact', sessionId, subject: { kind: 'generation', generation } }}
            />
          }
          meta={
            <MetaRow
              items={[
                generation.model === null ? null : (
                  <span key="model" className="inline-flex items-center gap-1">
                    {generation.provider === null ? null : (
                      <ProviderGlyph id={generation.provider} />
                    )}
                    {modelLabel(generation.model, generation.provider)}
                  </span>
                ),
                generation.startedAt === null ? null : (
                  <span key="started" className="tabular-nums">
                    <RelativeTime
                      iso={generation.startedAt}
                      title={formatDateTime({ at: generation.startedAt, hasYear: true })}
                    />
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
          <div aria-hidden className="flex flex-col gap-3">
            {SKELETON_WIDTHS.map((width) => (
              <Skeleton key={width} className={cn('h-2.5 rounded-sm', width)} />
            ))}
          </div>
        ) : null}
      </div>
    </PaneShell>
  );
};
