import { useEffect, useRef, type ReactNode } from 'react';
import type { SessionId, WorkspaceId } from '@goodboy/types';
import { PromptField } from '../../../../shared/components/PromptField';
import { useAutoTreeLimit } from '../../../auto/useAutoTreeLimit';
import { QuickActionsPopover } from '../../../quick-actions/QuickActionsPopover';
import type { AgentKind } from '../../agent-kind';
import { RUN_ROUTE_COPY } from '../../startRun/runRouteCopy';
import { startRunBranchOf } from '../../startRun/startRunBranchOf';
import { startRunDetailOf } from '../../startRun/startRunDetailOf';
import { startRunEventName } from '../../startRun/startRunEventName';
import { startRunFileOf } from '../../startRun/startRunFileOf';
import type { StartRunSources } from '../../startRun/startRunSources';
import { RunsStartForm } from '../StartForm/RunsStartForm';
import { RunModelChip } from './RunModelChip';
import { StartRunFileChip } from './StartRunFileChip';
import { useRunPrefixMenu } from './useRunPrefixMenu';
import type { SessionDraftMount } from '../../../../store/slices/sessionDraft/startSessionFromDraft';
import { useStartRun } from './useStartRun';

type SlotParams = {
  readonly isStarting: boolean;
  readonly text: string;
  readonly setText: (text: string) => void;
};

type LeaveParams = {
  readonly text: string;
};

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly sessionId: SessionId | null;
  readonly mount?: SessionDraftMount | null;
  readonly role?: AgentKind | null;
  readonly label?: string;
  readonly fieldLabel?: string;
  readonly placeholder?: string;
  readonly hint?: string | null;
  readonly demoAnchor?: string;
  readonly seedText?: string;
  readonly seedBranch?: string | null;
  readonly sources?: StartRunSources | null;
  readonly header?: ReactNode;
  readonly note?: string | null;
  readonly blockedReason?: string | null;
  readonly minRows?: number;
  readonly isFromSources?: boolean;
  readonly between?: (params: SlotParams) => ReactNode;
  readonly actions?: (params: SlotParams) => ReactNode;
  readonly onStarted?: () => void;
  readonly onLaunched?: () => void;
  readonly onLeave?: (params: LeaveParams) => void;
};

export const StartRun = ({
  workspaceId,
  sessionId,
  mount = null,
  role = null,
  label = RUN_ROUTE_COPY.label,
  fieldLabel = label,
  placeholder = RUN_ROUTE_COPY.placeholder,
  hint = RUN_ROUTE_COPY.hint,
  demoAnchor,
  seedText,
  seedBranch,
  sources = null,
  header,
  note,
  blockedReason = null,
  minRows,
  isFromSources = false,
  between,
  actions,
  onStarted,
  onLaunched,
  onLeave,
}: Props) => {
  const limit = useAutoTreeLimit({ workspaceId, sessionId });
  const run = useStartRun({
    workspaceId,
    sessionId,
    mount,
    role,
    seedText,
    seedBranch,
    sources,
    onStarted,
    onLaunched,
    prepare: limit.start,
    settleLimit: limit.settle,
  });
  const sectionRef = useRef<HTMLElement | null>(null);
  const hasText = run.text.trim() !== '';
  const menu = useRunPrefixMenu({
    text: run.text,
    presets: run.presets,
    setText: run.setText,
    onPick: run.setRunAs,
  });
  const { setText, setFile, setBranch } = run;
  const textRef = useRef(run.text);
  textRef.current = run.text;
  const leaveRef = useRef(onLeave);
  leaveRef.current = onLeave;

  useEffect(() => () => leaveRef.current?.({ text: textRef.current }), []);

  useEffect(() => {
    if (isFromSources) {
      return;
    }
    const onOpen = (event: Event): void => {
      const text = startRunDetailOf({ event });
      if (text !== '') {
        setText(text);
      }
      const file = startRunFileOf({ event });
      if (file !== null) {
        setFile(file);
      }
      const branch = startRunBranchOf({ event });
      if (branch !== null) {
        setBranch(branch);
      }
      window.requestAnimationFrame(() =>
        sectionRef.current?.querySelector<HTMLTextAreaElement>('textarea')?.focus(),
      );
    };
    const name = startRunEventName({ sessionId });
    window.addEventListener(name, onOpen);
    return () => window.removeEventListener(name, onOpen);
  }, [isFromSources, sessionId, setBranch, setFile, setText]);

  const slot: SlotParams = { isStarting: run.isStarting, text: run.text, setText: run.setText };

  return (
    <section
      ref={sectionRef}
      aria-label={label}
      className={isFromSources ? 'flex min-w-0 flex-col gap-4' : 'flex min-w-0 flex-col gap-2'}
    >
      {run.file === null ? null : (
        <StartRunFileChip
          file={run.file}
          isDisabled={run.isStarting}
          onRemove={() => setFile(null)}
        />
      )}
      <div className="relative">
        {menu.isOpen ? (
          <QuickActionsPopover
            items={menu.items}
            emptyHint={menu.emptyHint}
            onSelect={menu.onSelect}
            onDismiss={menu.dismiss}
          />
        ) : null}
        <PromptField
          kind="message"
          label={fieldLabel}
          value={run.text}
          onChange={run.setText}
          onSubmit={() => void run.start()}
          isSubmitBlocked={!hasText || run.isStarting || blockedReason !== null}
          placeholder={placeholder}
          disabled={run.isStarting}
          minRows={minRows ?? (hasText ? 2 : 1)}
          maxRows={isFromSources ? 10 : 8}
          keyLabels={{ send: 'start' }}
          files={run.files}
          notice={run.filesNotice}
          header={header}
          model={<RunModelChip model={run.model} isDisabled={run.isStarting} variant="pill" />}
        />
      </div>
      {between === undefined ? null : between(slot)}
      <RunsStartForm
        workspaceId={workspaceId}
        sessionId={sessionId}
        role={role}
        run={run}
        limit={limit}
        hint={hint}
        demoAnchor={demoAnchor}
        note={note}
        blockedReason={blockedReason}
        canDiscard={!isFromSources}
        isBranchLocked={isFromSources}
        actions={actions === undefined ? null : actions(slot)}
      />
    </section>
  );
};
