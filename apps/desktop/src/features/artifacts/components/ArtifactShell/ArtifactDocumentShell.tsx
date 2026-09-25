import { useState } from 'react';
import { RotateCw, Trash2 } from 'lucide-react';
import { Button, InlineConfirm, Textarea, formatError } from '@goodboy/ui';
import type { Agent, SessionId } from '@goodboy/types';
import { useAppStore, useSessionOpenQuestions } from '../../../../store';
import { PaneShell } from '../../../../shared/components/PaneShell';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { useAgentStartedToast } from '../../../../shared/hooks/useAgentStartedToast';
import { describeArtifactStatus } from '../../artifact-status';
import { describePlanStatus } from '../../../plans/plan-status';
import { parsePlanSource, planToSource } from '../../../plans/planSource';
import {
  planPartsProgress,
  planSplitSentence,
} from '../../../plans/components/PlanParts/planPartRows';
import { planPartsPresentation } from '../../../plans/components/PlanParts/planPartsPresentation';
import { usePlanPartRows } from '../../../plans/components/PlanParts/usePlanPartRows';
import { useArtifactExport } from '../../hooks/useArtifactExport';
import { useReportRegenerate } from '../../../reports/useReportRegenerate';
import { ReportStudio } from '../../../reports/components/ReportStudio';
import { WireframeStudio } from '../../../wireframes/components/WireframeStudio';
import { WireframeDivergenceChip } from '../../../wireframes/components/WireframeDivergenceChip';
import { WireframeVariantAction } from '../../../wireframes/components/WireframeVariantAction';
import { ArtifactPlanBody } from './ArtifactPlanBody';
import { artifactActions, type ArtifactActionSubject } from './artifactActions';
import type { ArtifactDocumentSubject } from './artifactShellSubject';
import { ArtifactDrawerToggles } from './ArtifactDrawerToggles';
import { ArtifactExportStatus } from './ArtifactExportStatus';
import { ArtifactShellActions, type ArtifactActionHandles } from './ArtifactShellActions';
import { ArtifactShellHeader } from './ArtifactShellHeader';
import { ArtifactShellMeta } from './ArtifactShellMeta';
import { ArtifactStateChip } from './ArtifactStateChip';

type Props = {
  readonly sessionId: SessionId;
  readonly subject: ArtifactDocumentSubject;
  readonly agents: ReadonlyArray<Agent>;
};

type Armed = 'runAgain' | 'discard' | null;

const PLAN_TITLE_MISSING = 'The first line is the plan title. Add one before saving.';

export const ArtifactDocumentShell = ({ sessionId, subject, agents }: Props) => {
  const { artifact } = subject;
  const plan = subject.kind === 'plan' ? subject.plan : null;
  const openQuestionCount = useSessionOpenQuestions(sessionId).length;
  const runPlan = useAppStore((s) => s.runPlan);
  const deletePlan = useAppStore((s) => s.deletePlan);
  const restorePlan = useAppStore((s) => s.restorePlan);
  const updatePlanBody = useAppStore((s) => s.updatePlanBody);
  const updateArtifactSource = useAppStore((s) => s.updateArtifactSource);
  const loadSessionArtifacts = useAppStore((s) => s.loadSessionArtifacts);
  const selectAgent = useAppStore((s) => s.selectAgent);
  const openDrawer = useAppStore((s) => s.openDrawer);
  const exporter = useArtifactExport({ artifact });
  const regenerate = useReportRegenerate({ sessionId, artifact });
  const announceAgentStarted = useAgentStartedToast();
  const [draft, setDraft] = useState<string | null>(null);
  const [armed, setArmed] = useState<Armed>(null);
  const [isSpawning, setIsSpawning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const partRows = usePlanPartRows({ sessionId, plan, agents });
  const hasRun = plan !== null && plan.consumptionCount > 0;
  const progress = planPartsProgress({ rows: partRows, hasRun });
  const isPlanRunning = progress.kind === 'running' || progress.kind === 'question';

  const actionSubject: ArtifactActionSubject =
    subject.kind === 'plan'
      ? { kind: 'plan', status: subject.plan.status, isRunning: isPlanRunning }
      : { kind: subject.kind, status: artifact.status };
  const set = artifactActions({ subject: actionSubject });
  const copyLabel = artifact.sourceFormat === 'json' ? 'Copy JSON' : 'Copy markdown';

  const run = async () => {
    if (plan === null || isSpawning) {
      return;
    }
    setIsSpawning(true);
    setError(null);
    try {
      const agentId = await runPlan(sessionId, plan.id);
      announceAgentStarted({
        sessionId,
        agentId,
        title: 'Implementer started',
        message: 'An agent is running this plan. You can keep working.',
      });
    } catch (cause) {
      setError(formatError(cause));
    } finally {
      setIsSpawning(false);
    }
  };

  const startEditing = () => {
    setError(null);
    setDraft(plan === null ? artifact.sourceText : planToSource(plan));
  };

  const save = async (next: string) => {
    setError(null);
    if (plan !== null) {
      const parsed = parsePlanSource({ source: next });
      if (parsed.title.length === 0) {
        setError(PLAN_TITLE_MISSING);
        return;
      }
      if (parsed.title === plan.title && parsed.bodyMd === plan.bodyMd) {
        setDraft(null);
        return;
      }
      await updatePlanBody(sessionId, plan.id, parsed.title, parsed.bodyMd);
      await loadSessionArtifacts(sessionId);
      setDraft(null);
      return;
    }
    if (next === artifact.sourceText) {
      setDraft(null);
      return;
    }
    await updateArtifactSource({
      sessionId,
      artifactId: artifact.id,
      title: artifact.title,
      sourceFormat: artifact.sourceFormat,
      sourceText: next,
      metadata: artifact.metadata,
    });
    setDraft(null);
  };

  const commit = (next: string) => {
    setIsSaving(true);
    save(next)
      .catch((cause: unknown) => setError(formatError(cause)))
      .finally(() => setIsSaving(false));
  };

  const handles: ArtifactActionHandles = {
    runPlan: { onClick: () => void run(), isBusy: isSpawning, isDisabled: isSpawning },
    runAgain: { onClick: () => setArmed('runAgain'), isDisabled: isSpawning },
    restore: {
      onClick: () => {
        if (plan !== null) {
          void restorePlan(sessionId, plan.id);
        }
      },
    },
    edit: { onClick: startEditing },
    print: {
      onClick: () => void exporter.savePdf(),
      isDisabled: !exporter.canSavePdf || exporter.status.kind === 'busy',
      hint: exporter.pdfHint,
    },
    copySource: {
      onClick: () => void exporter.copySource(),
      label: copyLabel,
      isDisabled: exporter.status.kind === 'busy',
    },
    saveSource: {
      onClick: () => void exporter.saveSource(),
      label: `${exporter.sourceActionLabel} to…`,
      isDisabled: exporter.status.kind === 'busy',
    },
    regenerate: {
      onClick: regenerate.regenerate,
      isDisabled: !regenerate.canRegenerate || regenerate.isRegenerating,
      hint: regenerate.hint,
    },
    discard: { onClick: () => setArmed('discard') },
  };

  const confirm =
    armed === 'runAgain' ? (
      <InlineConfirm
        role="alert"
        icon={<RotateCw size={ICON_SIZE.row} aria-hidden />}
        title="Run this plan again?"
        description="It already ran once. Running it again starts a new agent."
        confirmLabel="Run again"
        autoDisarmMs={4000}
        isBusy={isSpawning}
        onConfirm={async () => {
          await run();
          setArmed(null);
        }}
        onCancel={() => setArmed(null)}
        className="shrink-0"
      />
    ) : armed === 'discard' && plan !== null ? (
      <InlineConfirm
        role="danger"
        icon={<Trash2 size={ICON_SIZE.row} aria-hidden />}
        title={`Discard "${plan.title}"?`}
        description="It stays in the list, faint, and can be restored."
        confirmLabel="Discard"
        autoDisarmMs={4000}
        onConfirm={() => {
          void deletePlan(sessionId, plan.id);
          setArmed(null);
        }}
        onCancel={() => setArmed(null)}
        className="shrink-0"
      />
    ) : null;

  const actions =
    draft !== null ? (
      <span className="flex shrink-0 items-center gap-1.5">
        <Button variant="ghost" size="sm" onClick={() => setDraft(null)} disabled={isSaving}>
          Cancel
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={() => commit(draft)}
          isBusy={isSaving}
          data-testid="artifact-save"
        >
          Save
        </Button>
      </span>
    ) : (
      (confirm ?? (
        <span className="flex min-w-0 items-center gap-2">
          <ArtifactExportStatus status={exporter.status} />
          <ArtifactShellActions
            set={set}
            handles={handles}
            renderSecondary={(id) =>
              id === 'newVariant' && subject.kind === 'wireframe' ? (
                <WireframeVariantAction sessionId={sessionId} artifact={subject.artifact} />
              ) : null
            }
          />
        </span>
      ))
    );

  const creator = agents.find((agent) => agent.id === artifact.agentId) ?? null;
  const chip =
    subject.kind === 'wireframe' ? (
      <>
        <ArtifactStateChip
          presentation={describeArtifactStatus({ kind: 'wireframe', status: artifact.status })}
        />
        <WireframeDivergenceChip artifact={subject.artifact} creatorName={creator?.name ?? null} />
      </>
    ) : (
      <ArtifactStateChip
        presentation={
          plan === null
            ? describeArtifactStatus({ kind: artifact.kind, status: artifact.status })
            : (planPartsPresentation({ progress }) ??
              describePlanStatus({ status: plan.status, openQuestionCount }))
        }
      />
    );

  const alert = error ?? regenerate.error;

  return (
    <PaneShell
      header={
        <ArtifactShellHeader
          kind={artifact.kind}
          title={artifact.title}
          chip={chip}
          actions={actions}
          toggles={<ArtifactDrawerToggles sessionId={sessionId} artifactId={artifact.id} />}
          meta={
            <ArtifactShellMeta
              artifact={artifact}
              plan={plan}
              agents={agents}
              onOpenAgent={(agent) => void selectAgent(sessionId, agent.id)}
              onOpenDetails={() =>
                openDrawer({
                  kind: 'artifact',
                  sessionId,
                  payload: { artifactId: artifact.id, tab: 'details' },
                })
              }
            />
          }
        />
      }
    >
      <div
        data-testid="artifact-shell"
        data-artifact-kind={artifact.kind}
        className="flex min-w-0 flex-col gap-4"
      >
        {alert === null ? null : (
          <span role="alert" className="text-2xs text-danger">
            {alert}
          </span>
        )}
        {draft !== null ? (
          <Textarea
            autoFocus
            aria-label={`Edit ${artifact.title}`}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            className="artifact-prose-measure w-full font-mono text-sm"
            autoGrow
            minRows={12}
            maxRows={80}
          />
        ) : null}
        {draft === null && subject.kind === 'plan' ? (
          <ArtifactPlanBody
            plan={subject.plan}
            rows={partRows}
            hasRun={hasRun}
            splitSentence={planSplitSentence({
              count: partRows.length,
              plannerName: creator?.name ?? null,
            })}
            onOpenPart={(row) => {
              if (hasRun && row.agentId !== null) {
                void selectAgent(sessionId, row.agentId);
                return;
              }
              openDrawer({
                kind: 'plan-part',
                sessionId,
                payload: { planId: subject.plan.id, index: row.index },
              });
            }}
          />
        ) : null}
        {draft === null && subject.kind === 'report' ? (
          <ReportStudio artifact={subject.artifact} />
        ) : null}
        {subject.kind === 'wireframe' ? (
          <WireframeStudio sessionId={sessionId} artifact={subject.artifact} />
        ) : null}
      </div>
    </PaneShell>
  );
};
