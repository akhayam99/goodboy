import { useEffect, useRef, type ReactNode } from 'react';
import { Button, FormActions } from '@goodboy/ui';
import type { SessionId, WorkspaceId } from '@goodboy/types';
import { PromptField } from '../../../../shared/components/PromptField';
import { NAMES } from '../../../../shared/utils/names';
import { AutoLimitChip } from '../../../auto/AutoLimitChip';
import { useAutoTreeLimit } from '../../../auto/useAutoTreeLimit';
import { QuickActionsPopover } from '../../../quick-actions/QuickActionsPopover';
import type { AgentKind } from '../../agent-kind';
import { recommendationSummary } from '../../../../shared/components/RoutingPicker/recommendationSummary';
import { RUN_ROUTE_COPY } from '../../startRun/runRouteCopy';
import { runKindOfRoute } from '../../startRun/runKindOfRoute';
import { startRunDetailOf } from '../../startRun/startRunDetailOf';
import { startRunEventName } from '../../startRun/startRunEventName';
import { startRunFileOf } from '../../startRun/startRunFileOf';
import { RunChoiceChips } from './RunChoiceChips';
import { StartRunFileChip } from './StartRunFileChip';
import { useRunPrefixMenu } from './useRunPrefixMenu';
import type { SessionDraftMount } from '../../../../store/slices/sessionDraft/startSessionFromDraft';
import { useStartRun } from './useStartRun';

type ActionsParams = {
  readonly isStarting: boolean;
};

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly sessionId: SessionId | null;
  readonly mount?: SessionDraftMount | null;
  readonly role?: AgentKind | null;
  readonly placeholder?: string;
  readonly hint?: string | null;
  readonly demoAnchor?: string;
  readonly actions?: (params: ActionsParams) => ReactNode;
  readonly onStarted?: () => void;
};

export const StartRun = ({
  workspaceId,
  sessionId,
  mount = null,
  role = null,
  placeholder = RUN_ROUTE_COPY.placeholder,
  hint = RUN_ROUTE_COPY.hint,
  demoAnchor,
  actions,
  onStarted,
}: Props) => {
  const limit = useAutoTreeLimit({ workspaceId, sessionId });
  const run = useStartRun({
    workspaceId,
    sessionId,
    mount,
    role,
    onStarted,
    prepare: limit.persist,
  });
  const shape = runKindOfRoute({ route: run.route.route }).shape;
  const limitKind = shape === 'agent' ? null : shape;
  const sectionRef = useRef<HTMLElement | null>(null);
  const hasText = run.text.trim() !== '';
  const modelSummary = recommendationSummary({
    provider: run.model.effective.provider,
    model: run.model.effective.model,
    effort: run.model.effective.effort,
  });
  const menu = useRunPrefixMenu({
    text: run.text,
    presets: run.presets,
    setText: run.setText,
    onPick: run.setRunAs,
  });
  const { setText, setFile } = run;

  useEffect(() => {
    const onOpen = (event: Event): void => {
      const text = startRunDetailOf({ event });
      if (text !== '') {
        setText(text);
      }
      const file = startRunFileOf({ event });
      if (file !== null) {
        setFile(file);
      }
      sectionRef.current?.querySelector<HTMLTextAreaElement>('textarea')?.focus();
    };
    const name = startRunEventName({ sessionId });
    window.addEventListener(name, onOpen);
    return () => window.removeEventListener(name, onOpen);
  }, [sessionId, setFile, setText]);

  return (
    <section
      ref={sectionRef}
      aria-label={RUN_ROUTE_COPY.label}
      className="flex min-w-0 flex-col gap-2"
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
          label={RUN_ROUTE_COPY.label}
          value={run.text}
          onChange={run.setText}
          onSubmit={() => void run.start()}
          isSubmitBlocked={!hasText || run.isStarting}
          placeholder={placeholder}
          disabled={run.isStarting}
          minRows={hasText ? 2 : 1}
          maxRows={8}
          keyLabels={{ send: 'start' }}
          files={run.files}
          notice={run.filesNotice}
        />
      </div>
      {hasText ? (
        <p data-run-route-line="" className="text-meta text-muted-foreground">
          {[
            `${RUN_ROUTE_COPY.runAs.startsAs} ${run.route.route.choice}`,
            ...(role === null ? [modelSummary] : []),
            run.route.route.why,
          ].join(' · ')}
        </p>
      ) : null}
      {hint === null || hasText ? null : <p className="text-meta text-muted-foreground">{hint}</p>}
      <FormActions
        leading={
          <div className="flex min-w-0 flex-wrap items-center gap-1">
            <RunChoiceChips run={run} workspaceId={workspaceId} role={role} />
            {limitKind === null ? null : (
              <AutoLimitChip limit={limit} kind={limitKind} isDisabled={run.isStarting} />
            )}
          </div>
        }
        error={run.error}
      >
        {actions === undefined ? null : actions({ isStarting: run.isStarting })}
        {hasText && !run.isStarting ? (
          <Button variant="ghost" size="sm" onClick={run.discard}>
            {RUN_ROUTE_COPY.discard}
          </Button>
        ) : null}
        <Button
          size="sm"
          disabled={!hasText || run.isStarting}
          isBusy={run.isStarting}
          busyLabel={RUN_ROUTE_COPY.starting}
          onClick={() => void run.start()}
          data-demo-anchor={demoAnchor}
        >
          {run.error === null ? RUN_ROUTE_COPY.start : NAMES.retry}
        </Button>
      </FormActions>
    </section>
  );
};
