import { useMemo } from 'react';
import { ArrowLeft, Square } from 'lucide-react';
import { Button, Chip, Divider, PANE_RHYTHM, ScrollFade, SectionHeader, cn } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import {
  ARTIFACT_GENERATION_PRESENTATION,
  type ArtifactGeneration,
} from '../../artifactCollection';
import { useSessionOpenQuestions } from '../../../../store';
import { OpenQuestionCluster } from '../../../chat/components/ChatView/OpenQuestionCluster';
import { ArtifactScouts } from './ArtifactScouts';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { stateDescription } from '../../../../shared/utils/statePresentation';
import { PageCrumbRow } from '../../../../shared/components/PaneShell/PageCrumbRow';

type Props = {
  readonly sessionId: SessionId;
  readonly generation: ArtifactGeneration;
  readonly onBack: () => void;
  readonly onStop: () => void;
  readonly onOpenAgent: () => void;
};

export const ArtifactRunDetail = ({
  sessionId,
  generation,
  onBack,
  onStop,
  onOpenAgent,
}: Props) => {
  const presentation = ARTIFACT_GENERATION_PRESENTATION[generation.kind][generation.state];
  const Icon = presentation.icon;
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
    <div
      data-testid="artifact-run-detail"
      className="flex h-full min-h-0 min-w-0 flex-col bg-background"
    >
      <PageCrumbRow />
      <div className={cn('flex h-11 shrink-0 items-center gap-2', PANE_RHYTHM.detail.band)}>
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="shrink-0"
          data-testid="artifact-run-back"
        >
          <ArrowLeft size={ICON_SIZE.row} aria-hidden />
          All artifacts
        </Button>
        <h2 className="min-w-0 shrink truncate text-sm font-semibold leading-snug text-foreground">
          {generation.title}
        </h2>
        <Chip
          tone={presentation.tone}
          size="xs"
          bordered={false}
          icon={<Icon size={ICON_SIZE.row} aria-hidden />}
          label={presentation.label}
          title={stateDescription({ presentation })}
          className="shrink-0"
        />
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onOpenAgent} data-testid="artifact-run-agent">
            Open the agent
          </Button>
          {generation.canStop ? (
            <Button variant="ghost" size="sm" onClick={onStop} data-testid="artifact-run-stop">
              <Square size={ICON_SIZE.row} aria-hidden />
              Stop
            </Button>
          ) : null}
        </div>
      </div>
      <Divider />
      <ScrollFade
        className="min-h-0 flex-1"
        viewportClassName={PANE_RHYTHM.detail.body}
        fadeSize={24}
      >
        <div className={cn(PANE_RHYTHM.column, 'flex flex-col gap-2')}>
          {questions.length > 0 && (
            <div data-testid="artifact-run-questions" className="flex min-w-0 flex-col gap-2">
              <SectionHeader label="Answer this before it can produce" />
              <OpenQuestionCluster
                questions={questions}
                sessionId={sessionId}
                viewerAgentId={generation.agentId}
              />
            </div>
          )}
          <SectionHeader label="Agents on this run" />
          <ArtifactScouts
            sessionId={sessionId}
            agentId={generation.agentId}
            emptyLine="no scout ran for this one, the agent writes it from the session alone"
          />
        </div>
      </ScrollFade>
    </div>
  );
};
