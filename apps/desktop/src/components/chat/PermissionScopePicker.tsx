import { useState } from 'react';
import { cn } from '@kay-am/ui';
import type { ProviderRunId, SessionId, TaskId } from '@kay-am/types';
import { useAppStore } from '../../store';
import { useToast } from '../Toast';

export type PermissionScope = 'global' | 'workspace' | 'task' | 'once' | 'deny';

const SCOPE_LABELS: Record<PermissionScope, string> = {
  global: 'approve global',
  workspace: 'approve workspace',
  task: 'approve session',
  once: 'approve once',
  deny: 'deny',
};

const SCOPE_TOAST: Record<PermissionScope, string> = {
  global: 'rule added: allow globally',
  workspace: 'rule added: allow for this workspace',
  task: 'rule added: allow for this session',
  once: 'allowed once (volatile, not persisted)',
  deny: 'rule added: deny for this session',
};

interface PermissionScopePickerProps {
  readonly taskId: TaskId;
  readonly agentId: SessionId;
  readonly toolUseId: string;
  readonly toolName: string;
  readonly runId: ProviderRunId;
  readonly onResolved: () => void;
}

export function PermissionScopePicker({
  taskId,
  agentId,
  toolUseId,
  toolName,
  runId,
  onResolved,
}: PermissionScopePickerProps) {
  const resolvePermissionRequest = useAppStore((s) => s.resolvePermissionRequest);
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);

  const handle = async (scope: PermissionScope) => {
    if (busy) return;
    setBusy(true);
    try {
      await resolvePermissionRequest({ taskId, agentId, toolUseId, toolName, runId, scope });
      showToast(scope === 'deny' ? 'warning' : 'success', SCOPE_TOAST[scope]);
      onResolved();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'failed to resolve permission');
    } finally {
      setBusy(false);
    }
  };

  const scopes: PermissionScope[] = ['global', 'workspace', 'task', 'once', 'deny'];

  const SCOPE_TITLES: Record<PermissionScope, string> = {
    global: 'allow for all sessions',
    workspace: 'allow for this workspace',
    task: 'allow for this task (recommended)',
    once: 'allow this time only (not saved)',
    deny: 'deny this request',
  };

  return (
    <div className="mt-1.5 flex flex-wrap gap-1">
      {scopes.map((scope) => (
        <button
          key={scope}
          type="button"
          disabled={busy}
          onClick={() => void handle(scope)}
          title={SCOPE_TITLES[scope]}
          className={cn(
            'rounded border px-2 py-0.5 text-2xs font-medium transition-colors',
            scope === 'task'
              ? 'border-transparent bg-primary text-primary-foreground hover:bg-primary/90'
              : scope === 'deny'
                ? 'border-danger/40 text-danger hover:bg-danger/10'
                : 'border-success/40 text-success hover:bg-success/10',
            busy && 'cursor-not-allowed opacity-50',
          )}
        >
          {SCOPE_LABELS[scope]}
        </button>
      ))}
    </div>
  );
}
