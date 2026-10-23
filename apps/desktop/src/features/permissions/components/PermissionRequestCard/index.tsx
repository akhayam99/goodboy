import { useState } from 'react';
import { Hand, ShieldCheck } from 'lucide-react';
import {
  AnchoredPopover,
  Button,
  ConfirmPopover,
  MenuTriggerButton,
  tintClasses,
  useDropdown,
} from '@goodboy/ui';
import { isFilePathTool, prefixRuleFor } from '@goodboy/core';
import type { AgentId, SessionId } from '@goodboy/types';
import type { TranscriptItem } from '../../../chat/utils/transcript-items';
import { TranscriptShell } from '../../../chat/components/TranscriptShell';
import { AppMenuList } from '../../../actions/AppMenuList';
import { formatRequestInput } from './formatRequestInput';
import { PromptField } from '../../../../shared/components/PromptField';
import { modeCopyOf } from '../../modeCopy';
import { AGENT_KIND_META, classifyAgent } from '../../../session/agent-kind';
import { useAppStore } from '../../../../store';
import { useToast } from '../../../../shared/components/Toast';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { sessionById } from '../../../../store/slices/sessions/sessionIndex';

const warningTint = tintClasses('warning');

type Props = {
  readonly item: Extract<TranscriptItem, { kind: 'permission_request' }>;
  readonly sessionId: SessionId | null;
  readonly agentId: AgentId | null;
};

type OverflowView = 'menu' | 'denyReason';

export const PermissionRequestCard = ({ item, sessionId, agentId }: Props) => {
  const [resolved, setResolved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [overflowView, setOverflowView] = useState<OverflowView>('menu');
  const [isConfirmingGlobal, setIsConfirmingGlobal] = useState(false);
  const [denyReason, setDenyReason] = useState('');
  const dropdown = useDropdown({ align: 'end', width: 'w-80', expectedWidth: 320 });
  const { open, close, toggle } = dropdown;

  const session = useAppStore((s) =>
    sessionId === null ? null : (sessionById(s.sessions, sessionId) ?? null),
  );
  const askerNoun = useAppStore((s) => {
    const asker =
      sessionId === null || agentId === null
        ? null
        : ((s.sessionPhaseRuns[sessionId] ?? []).find((run) => run.id === agentId) ?? null);
    return asker === null
      ? null
      : AGENT_KIND_META[
          classifyAgent({ agent: asker, override: s.agentKindOverride[asker.id] ?? null })
        ].noun;
  });
  const workspaceName = useAppStore(
    (s) => s.workspaces.find((w) => w.id === session?.workspaceId)?.name ?? null,
  );
  const allowAndContinue = useAppStore((s) => s.allowAndContinue);
  const resolvePermissionRequest = useAppStore((s) => s.resolvePermissionRequest);
  const denyWithReason = useAppStore((s) => s.denyWithReason);
  const reportError = useAppStore((s) => s.reportError);
  const { showToast } = useToast();

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
  const askerLabel = askerNoun ?? 'The agent';
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

  const handleAlwaysAllow = (scope: 'workspace' | 'global'): Promise<void> => {
    if (sessionId === null || agentId === null) {
      return Promise.resolve();
    }
    return withBusy(() =>
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
          {askerLabel} wants to run {item.toolName === 'Bash' ? 'a command' : `${item.toolName}`}
        </span>
        {resolved ? (
          <span className="ml-auto text-meta text-muted-foreground">Resolved</span>
        ) : null}
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
          <span className="font-medium text-foreground">{modeLabel}</span> is on
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
            onClick={() => void handleAlwaysAllow('workspace')}
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
          <ConfirmPopover
            role="alert"
            icon={<ShieldCheck size={ICON_SIZE.row} aria-hidden />}
            title={`${rule.label} in every workspace?`}
            description="Every session in every workspace runs it without asking again."
            confirmLabel="Allow everywhere"
            isBusy={busy}
            isOpen={isConfirmingGlobal}
            onConfirm={async () => {
              await handleAlwaysAllow('global');
              setIsConfirmingGlobal(false);
            }}
            onCancel={() => setIsConfirmingGlobal(false)}
            trigger={() => (
              <AnchoredPopover
                dropdown={dropdown}
                role={overflowView === 'menu' ? undefined : 'dialog'}
                ariaLabel={overflowView === 'menu' ? undefined : 'More permission actions'}
                trigger={
                  <MenuTriggerButton
                    label="More permission actions"
                    isOpen={open}
                    size="control"
                    disabled={busy}
                    onClick={toggle}
                  >
                    <CONCEPT_ICONS.more size={ICON_SIZE.control} aria-hidden />
                  </MenuTriggerButton>
                }
              >
                {overflowView === 'menu' && (
                  <AppMenuList
                    label="More permission actions"
                    onClose={closeOverflow}
                    entries={[
                      {
                        kind: 'item',
                        key: 'allow-session',
                        label: 'Allow all commands in this session',
                        isDisabled: busy,
                        shouldStayOpen: true,
                        onSelect: handleAllowSession,
                      },
                      {
                        kind: 'item',
                        key: 'allow-everywhere',
                        label: `${rule.label} everywhere`,
                        isDisabled: busy,
                        onSelect: () => setIsConfirmingGlobal(true),
                      },
                      {
                        kind: 'item',
                        key: 'deny-reason',
                        label: `Deny and tell ${askerNoun ?? 'the agent'} why…`,
                        isDisabled: busy,
                        shouldStayOpen: true,
                        onSelect: () => setOverflowView('denyReason'),
                      },
                    ]}
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
            )}
          />
        </div>
      )}
    </TranscriptShell>
  );
};
