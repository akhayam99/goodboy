import { useMemo } from 'react';
import { MetaRow, SectionHeader, PaneShell } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useSessionOpenQuestions } from '../../../../store';
import { formatDateTime } from '../../../../shared/utils/time/formatDateTime';
import { RelativeTime } from '../../../../shared/components/RelativeTime';
import { ProviderGlyph } from '../../../../shared/components/RoutingPicker/ProviderGlyph';
import { OpenQuestionCluster } from '../../../chat/components/ChatView/OpenQuestionCluster';
import { modelLabel } from '../../../chat/utils/chat-constants';
import type { ArtifactGeneration } from '../../artifactCollection';
import { ArtifactScouts } from '../ArtifactStudio/ArtifactScouts';
import { ArtifactFollowButton } from './ArtifactFollowButton';
import { ArtifactShellActions } from './ArtifactShellActions';
import { ArtifactShellHeader } from './ArtifactShellHeader';

type Props = {
  readonly sessionId: SessionId;
  readonly generation: ArtifactGeneration;
};

const WRITING_SENTENCE = 'Still writing. It opens here when the agent is done.';

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
            <span className="flex min-w-0 shrink-0 items-center gap-2">
              {generation.state === 'generating' ? (
                <ArtifactFollowButton sessionId={sessionId} agentId={generation.agentId} />
              ) : null}
              <ArtifactShellActions
                target={{
                  kind: 'artifact',
                  sessionId,
                  subject: { kind: 'generation', generation },
                }}
              />
            </span>
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
        {generation.state === 'generating' ? (
          <p data-testid="artifact-writing" className="text-body text-muted-foreground">
            {WRITING_SENTENCE}
          </p>
        ) : null}
        <div className="flex min-w-0 flex-col gap-2">
          <SectionHeader label="Agents on this run" />
          <ArtifactScouts
            sessionId={sessionId}
            agentId={generation.agentId}
            emptyLine="no scout ran for this one, the agent writes it from the session alone"
          />
        </div>
      </div>
    </PaneShell>
  );
};
