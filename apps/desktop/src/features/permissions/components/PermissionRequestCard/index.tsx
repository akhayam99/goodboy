import { useState } from 'react';
import { Hand, ShieldCheck } from 'lucide-react';
import {
  ROW_INTERACTIVE,
  cn,
  AnchoredPopover,
  Button,
  IconButton,
  InlineConfirm,
  tintClasses,
  useDropdown,
} from '@goodboy/ui';
import { isFilePathTool, prefixRuleFor } from '@goodboy/core';
import type { AgentId, SessionId } from '@goodboy/types';
import type { TranscriptItem } from '../../../chat/utils/transcript-items';
import { formatClock } from '../../../../shared/utils/time/formatClock';
import { TranscriptShell } from '../../../chat/components/TranscriptShell';
import { formatRequestInput } from './formatRequestInput';
import { PromptField } from '../../../../shared/components/PromptField';
import { modeCopyOf } from '../../modeCopy';
import { PROVIDER_LABEL } from '../../../providers/providerLabel';
import { useAppStore } from '../../../../store';
import { useToast } from '../../../../shared/components/Toast';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { sessionById } from '../../../../store/slices/sessions/sessionIndex';

const warningTint = tintClasses('warning');
const resolvedTint = tintClasses('success');
const MoreIcon = CONCEPT_ICONS.more;

type Props = {
  readonly item: Extract<TranscriptItem, { kind: 'permission_request' }>;
  readonly sessionId: SessionId | null;
  readonly agentId: AgentId | null;
};

type OverflowView = 'menu' | 'confirmGlobal' | 'denyReason';

export const PermissionRequestCard = ({ item, sessionId, agentId }: Props) => {
  const [resolved, setResolved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [overflowView, setOverflowView] = useState<OverflowView>('menu');
  const [denyReason, setDenyReason] = useState('');
  const dropdown = useDropdown({ align: 'end', width: 'w-80', expectedWidth: 320 });
  const { open, close, toggle } = dropdown;

  const session = useAppStore((s) =>
    sessionId === null ? null : (sessionById(s.sessions, sessionId) ?? null),
  );
  const workspaceName = useAppStore(
    (s) => s.workspaces.find((w) => w.id === session?.workspaceId)?.name ?? null,
  );
  const allowAndContinue = useAppStore((s) => s.allowAndContinue);
  const resolvePermissionRequest = useAppStore((s) => s.resolvePermissionRequest);
  const denyWithReason = useAppStore((s) => s.denyWithReason);
  const reportError = useAppStore((s) => s.reportError);
  const { showToast } = useToast();

  const timestamp = formatClock({ at: item.at });
  const inputPreview = formatRequestInput({ input: item.input });
  const commandText =
    item.toolName === 'Bash' &&
    typeof item.input === 'object' &&
    item.input !== null &&
    'command' in item.input &&
    typeof (item.input as { command: unknown }).command === 'string'
      ? (item.input as { command: string }).command
      : null;

  const canAct = !resolved && sessionId !== null && agentId !== null;
  const providerLabel =
    session === null ? null : PROVIDER_LABEL[session.providerPreference.defaultProvider];
  const modeLabel = session === null ? null : modeCopyOf({ mode: session.permissionMode }).label;
  const rule = prefixRuleFor({ toolName: item.toolName, input: item.input });
  const alwaysAllowLabel = isFilePathTool({ toolName: item.toolName })
    ? workspaceName === null
      ? rule.label
      : `${rule.label} in ${workspaceName}`
    : rule.label;

  const withBusy = async (action: () => Promise<void>) => {
    if (busy) {
      return;
    }
    setBusy(true);
    try {
      await action();
      close();
      setResolved(true);
    } catch (err) {
      void reportError({
        title: `Couldn't answer the ${item.toolName} request`,
        error: err,
        sessionId: sessionId ?? undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  const handleAllowAndContinue = () => {
    if (sessionId === null || agentId === null) {
      return;
    }
    void withBusy(() =>
      allowAndContinue({
        sessionId,
        agentId,
        toolUseId: item.toolUseId,
        toolName: item.toolName,
        input: item.input,
        runId: item.runId,
      }),
    );
  };

  const handleAlwaysAllow = (scope: 'workspace' | 'global') => {
    if (sessionId === null || agentId === null) {
      return;
    }
    void withBusy(() =>
      resolvePermissionRequest({
        sessionId,
        agentId,
        toolUseId: item.toolUseId,
        toolName: item.toolName,
        runId: item.runId,
        scope,
        pattern: rule.pattern,
      }),
    );
  };

  const handleDeny = () => {
    if (sessionId === null || agentId === null) {
      return;
    }
    void withBusy(async () => {
      await resolvePermissionRequest({
        sessionId,
        agentId,
        toolUseId: item.toolUseId,
        toolName: item.toolName,
        runId: item.runId,
        scope: 'deny',
      });
      showToast({ kind: 'info', message: `${item.toolName} denied for the rest of this session` });
    });
  };

  const handleAllowSession = () => {
    if (sessionId === null || agentId === null) {
      return;
    }
    void withBusy(() =>
      resolvePermissionRequest({
        sessionId,
        agentId,
        toolUseId: item.toolUseId,
        toolName: item.toolName,
        runId: item.runId,
        scope: 'session',
      }),
    );
  };

  const handleDenyWithReason = () => {
    if (sessionId === null || agentId === null) {
      return;
    }
    void withBusy(() =>
      denyWithReason({
        sessionId,
        agentId,
        toolUseId: item.toolUseId,
        toolName: item.toolName,
        runId: item.runId,
        reason: denyReason,
      }),
    );
  };

  const closeOverflow = () => {
    close();
    setOverflowView('menu');
    setDenyReason('');
  };

  return (
    <TranscriptShell
      tone="warning"
      variant="boxed"
      emphasis
      className="flex flex-col gap-2 text-label"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Hand size={ICON_SIZE.control} aria-hidden className={warningTint.icon} />
        <span className="text-heading text-foreground">
          {providerLabel === null ? 'The agent' : providerLabel} wants to run{' '}
          {item.toolName === 'Bash' ? 'a command' : `${item.toolName}`}
        </span>
        {resolved ? (
          <span className={`ml-auto text-meta ${resolvedTint.text}`}>resolved</span>
        ) : (
          <span className="ml-auto text-meta text-muted-foreground">{timestamp}</span>
        )}
      </div>
      {commandText !== null ? (
        <code className="min-w-0 break-words rounded-md bg-elevated px-2 py-1 text-code text-foreground">
          {commandText}
        </code>
      ) : (
        inputPreview !== null && (
          <code className="min-w-0 break-words rounded-md bg-elevated px-2 py-1 text-code text-muted-foreground">
            {inputPreview}
          </code>
        )
      )}
      {modeLabel !== null && (
        <span className="text-muted-foreground">
          blocked by <span className="font-medium text-foreground">{modeLabel}</span>
        </span>
      )}
      {canAct && (
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" disabled={busy} onClick={handleAllowAndContinue}>
            Allow and continue
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={busy}
            onClick={() => handleAlwaysAllow('workspace')}
          >
            {alwaysAllowLabel}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={handleDeny}
            className="text-danger hover:text-danger"
          >
            Deny
          </Button>
          <span className="ml-auto" />
          <AnchoredPopover
            dropdown={dropdown}
            role={overflowView === 'menu' ? 'menu' : 'dialog'}
            ariaLabel="More permission actions"
            className={overflowView === 'menu' ? 'py-1' : undefined}
            trigger={
              <IconButton
                icon={MoreIcon}
                label="More permission actions"
                variant="ghost"
                disabled={busy}
                aria-haspopup="menu"
                aria-expanded={open}
                onClick={toggle}
              />
            }
          >
            {overflowView === 'menu' && (
              <>
                <button
                  type="button"
                  role="menuitem"
                  disabled={busy}
                  onClick={handleAllowSession}
                  className={cn(
                    'flex w-full items-center px-3 py-2 text-left text-label text-foreground',
                    ROW_INTERACTIVE,
                  )}
                >
                  Allow all commands in this session
                </button>
                <button
                  type="button"
                  role="menuitem"
                  disabled={busy}
                  onClick={() => setOverflowView('confirmGlobal')}
                  className={cn(
                    'flex w-full items-center px-3 py-2 text-left text-label text-foreground',
                    ROW_INTERACTIVE,
                  )}
                >
                  {rule.label} everywhere
                </button>
                <button
                  type="button"
                  role="menuitem"
                  disabled={busy}
                  onClick={() => setOverflowView('denyReason')}
                  className={cn(
                    'flex w-full items-center px-3 py-2 text-left text-label text-foreground',
                    ROW_INTERACTIVE,
                  )}
                >
                  Deny and tell {providerLabel ?? 'the agent'} why…
                </button>
              </>
            )}
            {overflowView === 'confirmGlobal' && (
              <InlineConfirm
                role="alert"
                icon={<ShieldCheck size={ICON_SIZE.row} aria-hidden />}
                title={`${rule.label} in every workspace?`}
                description="Every session in every workspace runs it without asking again."
                confirmLabel="Allow everywhere"
                surface="plain"
                isBusy={busy}
                onConfirm={() => handleAlwaysAllow('global')}
                onCancel={closeOverflow}
              />
            )}
            {overflowView === 'denyReason' && (
              <div className="flex flex-col gap-2 p-3">
                <PromptField
                  kind="document"
                  label="Why you deny it"
                  value={denyReason}
                  onChange={setDenyReason}
                  placeholder="Say why, so it does not try again this way"
                  minRows={2}
                  maxRows={4}
                  className="w-full bg-elevated"
                  textClassName="text-label"
                />
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" disabled={busy} onClick={closeOverflow}>
                    Cancel
                  </Button>
                  <Button
                    variant="ghost-danger"
                    size="sm"
                    disabled={busy}
                    onClick={handleDenyWithReason}
                  >
                    Deny
                  </Button>
                </div>
              </div>
            )}
          </AnchoredPopover>
        </div>
      )}
    </TranscriptShell>
  );
};
