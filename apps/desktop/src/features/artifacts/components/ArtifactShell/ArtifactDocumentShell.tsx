import { useEffect, useState } from 'react';
import { Button, InlineConfirm, Textarea, formatError, PaneShell } from '@goodboy/ui';
import type { Agent, SessionId } from '@goodboy/types';
import { useAppStore, useSessionOpenQuestions, agentPlace } from '../../../../store';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { usePlanRevising } from '../../../plans/useRevisingPlans';
import { usePlanRun } from '../../../plans/usePlanRun';
import { artifactStateOf } from '../../artifactStateOf';
import { NO_PLAN_STATE_INPUTS, planStateInputsOf } from '../../../plans/planStateInputs';
import { parsePlanSource, planToSource } from '../../../plans/planSource';
import {
  planPartsProgress,
  planSplitSentence,
} from '../../../plans/components/PlanParts/planPartRows';
import { usePlanPartRows } from '../../../plans/components/PlanParts/usePlanPartRows';
import { useArtifactExport } from '../../hooks/useArtifactExport';
import { useArtifactSavedCopy } from '../../hooks/useArtifactSavedCopy';
import { useRecordArtifactOpened } from '../../hooks/useRecordArtifactOpened';
import { useReportRegenerate } from '../../../reports/useReportRegenerate';
import { ReportStudio } from '../../../reports/components/ReportStudio';
import { WireframeViewer } from '../../../wireframes/components/WireframeViewer';
import { WireframeDivergenceChip } from '../../../wireframes/components/WireframeDivergenceChip';
import { WireframeShellActions } from './WireframeShellActions';
import { ArtifactPlanBody } from './ArtifactPlanBody';
import type { ArtifactDocumentSubject } from './artifactShellSubject';
import { ArtifactDrawerToggles } from './ArtifactDrawerToggles';
import { ArtifactExportStatus } from './ArtifactExportStatus';
import { ArtifactShellActions } from './ArtifactShellActions';
import { ARTIFACT_EDIT_EVENT } from '../../../actions/kinds/artifact';
import type { ArtifactActionTarget, ArtifactPorts, ResolvedAction } from '../../../actions/types';
import { ArtifactShellHeader } from './ArtifactShellHeader';
import { ArtifactShellMeta } from './ArtifactShellMeta';
import { ArtifactStateChip } from './ArtifactStateChip';

type Props = {
  readonly sessionId: SessionId;
  readonly subject: ArtifactDocumentSubject;
  readonly agents: ReadonlyArray<Agent>;
};

type Armed = {
  readonly action: ResolvedAction;
  readonly run: () => Promise<void>;
} | null;

const COPY_NOT_READY = 'The saved copy is not ready yet';

const PLAN_TITLE_MISSING = 'The first line is the plan title. Add one before saving.';

export const ArtifactDocumentShell = ({ sessionId, subject, agents }: Props) => {
  const { artifact } = subject;
  const plan = subject.kind === 'plan' ? subject.plan : null;
  const openQuestionCount = useSessionOpenQuestions(sessionId).length;
  const updatePlanBody = useAppStore((s) => s.updatePlanBody);
  const updateArtifactSource = useAppStore((s) => s.updateArtifactSource);
  const loadSessionArtifacts = useAppStore((s) => s.loadSessionArtifacts);
  const navigate = useAppStore((s) => s.navigate);
  const openDrawer = useAppStore((s) => s.openDrawer);
  const exporter = useArtifactExport({ artifact });
  const savedCopy = useArtifactSavedCopy({ sessionId, artifact });
  useRecordArtifactOpened({ sessionId, artifactId: artifact.id });
  const regenerate = useReportRegenerate({ sessionId, artifact });
  const planRun = usePlanRun({ sessionId, planId: artifact.id });
  const revising = usePlanRevising({ sessionId, planId: plan === null ? null : plan.id });
  const [draft, setDraft] = useState<string | null>(null);
  const [armed, setArmed] = useState<Armed>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wireframeScreenId, setWireframeScreenId] = useState<string | null>(null);
  const partRows = usePlanPartRows({ sessionId, plan, agents });
  const hasRun = plan !== null && plan.consumptionCount > 0;
  const progress = planPartsProgress({ rows: partRows, hasRun });
  const isPlanRunning = progress.kind === 'running' || progress.kind === 'question';

  const copyLabel = artifact.sourceFormat === 'json' ? 'Copy JSON' : 'Copy markdown';

  const run = async () => {
    if (plan === null) {
      return;
    }
    setError(null);
    await planRun.run();
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

  const isCopyMissing = savedCopy.location === null || !savedCopy.location.exists;
  const regenerateBlocked = `${regenerate.hint.charAt(0).toUpperCase()}${regenerate.hint.slice(1)}`;
  const ports: ArtifactPorts = {
    runPlan: { run, isBusy: planRun.isSpawning },
    runAgain: { run, isBusy: planRun.isSpawning },
    edit: { run: startEditing },
    openInBrowser: {
      run: savedCopy.openInBrowser,
      blockedReason: isCopyMissing ? COPY_NOT_READY : null,
      description: savedCopy.error,
    },
    copySource: {
      run: exporter.copySource,
      label: copyLabel,
      isBusy: exporter.status.kind === 'busy',
    },
    saveSource: {
      run: exporter.saveSource,
      label: `${exporter.sourceActionLabel} to…`,
      isBusy: exporter.status.kind === 'busy',
    },
    showInFinder: {
      run: savedCopy.reveal,
      blockedReason: isCopyMissing ? COPY_NOT_READY : null,
    },
    regenerate: {
      run: regenerate.regenerate,
      blockedReason: regenerate.canRegenerate ? null : regenerateBlocked,
      isBusy: regenerate.isRegenerating,
    },
  };
  const target: ArtifactActionTarget = {
    kind: 'artifact',
    sessionId,
    subject: { kind: 'stored', artifactId: artifact.id, isPlanRunning },
    ports,
  };

  useEffect(() => {
    const onEditRequest = (event: Event) => {
      if (!(event instanceof CustomEvent) || event.detail?.artifactId !== artifact.id) {
        return;
      }
      startEditing();
    };
    window.addEventListener(ARTIFACT_EDIT_EVENT, onEditRequest);
    return () => window.removeEventListener(ARTIFACT_EDIT_EVENT, onEditRequest);
  });

  const armedConfirm = armed?.action.confirm ?? null;
  const confirm =
    armed !== null && armedConfirm !== null ? (
      <InlineConfirm
        role={armedConfirm.role}
        icon={<armed.action.icon size={ICON_SIZE.row} aria-hidden />}
        title={armedConfirm.title}
        description={armedConfirm.description}
        confirmLabel={armedConfirm.confirmLabel}
        autoDisarmMs={4000}
        isBusy={planRun.isSpawning}
        onConfirm={async () => {
          await armed.run();
          setArmed(null);
        }}
        onCancel={() => setArmed(null)}
        className="shrink-0"
      />
    ) : null;

  const actions =
    draft !== null ? (
      <span className="flex shrink-0 items-center gap-2">
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
          {subject.kind === 'wireframe' ? (
            <WireframeShellActions
              sessionId={sessionId}
              artifact={subject.artifact}
              target={target}
              exporter={exporter}
              screenId={wireframeScreenId}
              onArm={setArmed}
            />
          ) : (
            <ArtifactShellActions target={target} onArm={setArmed} />
          )}
        </span>
      ))
    );

  const creator = agents.find((agent) => agent.id === artifact.agentId) ?? null;
  const state = artifactStateOf({
    kind: artifact.kind,
    status: artifact.status,
    isNew: false,
    openQuestionCount,
    ...(plan === null
      ? NO_PLAN_STATE_INPUTS
      : planStateInputsOf({ plan, rows: partRows, revising })),
  });
  const chip =
    subject.kind === 'wireframe' ? (
      <>
        <ArtifactStateChip state={state} />
        <WireframeDivergenceChip artifact={subject.artifact} creatorName={creator?.name ?? null} />
      </>
    ) : (
      <ArtifactStateChip state={state} />
    );

  const alert = error ?? planRun.error ?? regenerate.error;

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
              onOpenAgent={(agent) =>
                navigate({ to: agentPlace({ sessionId, agentId: agent.id }) })
              }
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
          <span role="alert" className="text-meta text-danger">
            {alert}
          </span>
        )}
        {draft !== null ? (
          <Textarea
            autoFocus
            aria-label={`Edit ${artifact.title}`}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            className={`${plan === null ? 'artifact-prose-measure ' : ''}w-full font-mono text-body`}
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
                navigate({ to: agentPlace({ sessionId, agentId: row.agentId }) });
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
          <ReportStudio sessionId={sessionId} artifact={subject.artifact} />
        ) : null}
        {subject.kind === 'wireframe' ? (
          <WireframeViewer
            sessionId={sessionId}
            artifact={subject.artifact}
            onScreenChange={setWireframeScreenId}
          />
        ) : null}
      </div>
    </PaneShell>
  );
};
