import { useCallback, useMemo, useState } from 'react';
import { ArrowUpRight, Copy } from 'lucide-react';
import { DrawerFrame, IconButton, PageColumn, cn } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import type { SendArtifactCommentsResult } from '../../../../store/slices/artifact-comments/types';
import { agentPlace, sessionPlace, useAppStore, useSessionOpenQuestions } from '../../../../store';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { useActionEnv } from '../../../actions/useActionEnv';
import { useObjectActions } from '../../../actions/useObjectActions';
import type { ArtifactActionTarget } from '../../../actions/types';
import { planPartsProgress, planSplitSentence } from '../../../plans/planSurfaces';
import { plannerQuestionsOf } from '../../../plans/plannerQuestions';
import type { PlanModel } from '../../../plans/usePlanModel';
import { usePlanPrimaryAction } from '../../../plans/usePlanPrimaryAction';
import { ArtifactPlanBody } from '../ArtifactShell/ArtifactPlanBody';
import { PlanEditor } from '../PlanEditor';
import { usePlanEditor } from '../PlanEditor/usePlanEditor';
import { ArtifactPastVersion } from './ArtifactPastVersion';
import { PlanDrawerLine } from './PlanDrawerLine';
import { PlanDrawerNotes } from './PlanDrawerNotes';
import { PlanDrawerStateLine } from './PlanDrawerStateLine';
import { PlanDrawerToolbar } from './PlanDrawerToolbar';
import { planDrawerReasonOf } from './planDrawerReason';
import { planVersionNoteLabel, usePlanVersionNote } from './usePlanVersionNote';

type Props = {
  readonly sessionId: SessionId;
  readonly model: PlanModel;
  readonly revision: number | null;
  readonly onClose: () => void;
};

type Unchanged = Readonly<{ version: number }>;

const EDIT_ACTION_ID = 'artifact.edit';

const COPY_ACTION_ID = 'artifact.copySource';

export const PlanDrawerFrame = ({ sessionId, model, revision, onClose }: Props) => {
  const { plan, version, revising, state, rows, agents, hasRun } = model;
  const navigate = useAppStore((s) => s.navigate);
  const openDrawer = useAppStore((s) => s.openDrawer);
  const openQuestions = useSessionOpenQuestions(sessionId);
  const [unchanged, setUnchanged] = useState<Unchanged | null>(null);
  const progress = planPartsProgress({ rows, hasRun });
  const isRunning = progress.kind === 'running' || progress.kind === 'question';
  const pastVersion = revision !== null && revision !== version ? revision : null;
  const creator = agents.find((agent) => agent.id === plan.agentId) ?? null;
  const questions = useMemo(
    () => plannerQuestionsOf({ questions: openQuestions, plan }),
    [openQuestions, plan],
  );

  const { note, remember } = usePlanVersionNote({ artifactId: plan.id, version });
  const onSaved = useCallback(
    ({ revision: saved }: { readonly revision: number }) =>
      remember({ revision: saved, author: 'user' }),
    [remember],
  );
  const editor = usePlanEditor({ sessionId, plan, revision: version, onSaved });
  const action = usePlanPrimaryAction({ sessionId, plan, revising, isRunning });

  const target = useMemo<ArtifactActionTarget>(
    () => ({
      kind: 'artifact',
      sessionId,
      subject: { kind: 'stored', artifactId: plan.id, isPlanRunning: isRunning },
      ports: { edit: { run: editor.start } },
    }),
    [editor.start, isRunning, plan.id, sessionId],
  );
  const env = useActionEnv({ origin: 'button' });
  const { actions, run } = useObjectActions({ target, env });
  const editAction = actions.find((candidate) => candidate.id === EDIT_ACTION_ID) ?? null;
  const copyAction = actions.find((candidate) => candidate.id === COPY_ACTION_ID) ?? null;

  const onSent = useCallback(
    (result: SendArtifactCommentsResult) => {
      if (result.kind === 'revised') {
        remember({ revision: result.revision, author: 'agent' });
      }
      setUnchanged(result.kind === 'unchanged' ? { version } : null);
    },
    [remember, version],
  );

  const reason = planDrawerReasonOf({
    isEditing: editor.isEditing,
    primary: action.primary,
    state,
    drafts: action.drafts,
    editBlock: editAction?.blockedReason ?? null,
  });
  const line = (
    <PlanDrawerLine
      confirm={editor.isEditing ? null : action.confirm}
      reason={reason}
      note={note === null || pastVersion !== null ? null : planVersionNoteLabel({ note })}
    />
  );
  const toolbar = (
    <PlanDrawerToolbar
      version={pastVersion ?? version}
      state={state}
      isPast={pastVersion !== null}
      action={action}
      editor={editor}
      editAction={editAction}
      onEdit={() => void run({ actionId: EDIT_ACTION_ID })}
    />
  );
  const isRevising = revising.kind === 'revising';
  const isUnchangedShown =
    unchanged !== null && unchanged.version === version && !isRevising && pastVersion === null;

  const content = (
    <div data-testid="plan-drawer" className="flex min-h-full min-w-0 flex-col gap-4">
      {pastVersion === null ? (
        <>
          <PlanDrawerNotes
            sessionId={sessionId}
            questions={questions}
            isUnchanged={isUnchangedShown}
            onOpenReply={() => navigate({ to: agentPlace({ sessionId, agentId: plan.agentId }) })}
          />
          <PlanDrawerStateLine revising={revising} />
          <div
            data-testid="plan-drawer-body"
            data-revising={isRevising ? 'true' : 'false'}
            className={cn(
              'flex min-w-0 flex-1 flex-col motion-safe:transition-opacity',
              isRevising && 'pointer-events-none select-none opacity-55',
            )}
          >
            {editor.isEditing ? (
              <PlanEditor editor={editor} title={plan.title} />
            ) : (
              <ArtifactPlanBody
                plan={plan}
                rows={rows}
                hasRun={hasRun}
                splitSentence={planSplitSentence({
                  count: rows.length,
                  plannerName: creator?.name ?? null,
                })}
                onSent={onSent}
                isApproveInBar={false}
                onOpenPart={(row) => {
                  if (hasRun && row.agentId !== null) {
                    navigate({ to: agentPlace({ sessionId, agentId: row.agentId }) });
                    return;
                  }
                  openDrawer({
                    kind: 'plan-part',
                    sessionId,
                    payload: { planId: plan.id, index: row.index },
                  });
                }}
              />
            )}
          </div>
        </>
      ) : (
        <ArtifactPastVersion
          artifactId={plan.id}
          revision={pastVersion}
          latest={version}
          onOpenCurrent={() =>
            openDrawer({
              kind: 'artifact-document',
              sessionId,
              payload: { artifactId: plan.id, revision: null },
            })
          }
        />
      )}
    </div>
  );

  return (
    <DrawerFrame
      title={plan.title}
      icon={CONCEPT_ICONS.plans}
      iconClassName="text-muted-foreground"
      onClose={onClose}
      action={
        <span className="flex min-w-0 items-center gap-1">
          <IconButton
            icon={ArrowUpRight}
            iconSize={ICON_SIZE.row}
            label="Open in Artifacts"
            variant="ghost"
            onClick={() =>
              navigate({
                to: sessionPlace({
                  sessionId,
                  lens: 'plans',
                  target: { kind: 'artifact', artifactId: plan.id },
                }),
              })
            }
          />
          {copyAction === null ? null : (
            <IconButton
              icon={Copy}
              iconSize={ICON_SIZE.row}
              label="Copy markdown"
              variant="ghost"
              onClick={() => void run({ actionId: COPY_ACTION_ID })}
            />
          )}
        </span>
      }
      toolbar={
        <>
          {toolbar}
          {line}
        </>
      }
    >
      <PageColumn width="measure" className="px-0">
        {content}
      </PageColumn>
    </DrawerFrame>
  );
};
