import { useState } from 'react';
import { cn } from '@kay-am/ui';
import type { ClaudePermissionMode, SessionId, TaskId, WorkspaceId } from '@kay-am/types';
import { useAppStore } from '../../store';
import { PermissionsPanel } from '../PermissionsPanel';
import { PermissionAuditPanel } from './PermissionAuditPanel';

type PanelTab = 'session-rules' | 'workspace-rules' | 'audit' | 'mode';

const TAB_LABELS: Record<PanelTab, string> = {
  'session-rules': 'session rules',
  'workspace-rules': 'workspace rules',
  audit: 'audit log',
  mode: 'mode',
};

const MODE_OPTIONS: ReadonlyArray<{ value: ClaudePermissionMode; label: string; description: string }> = [
  { value: 'bypassPermissions', label: 'bypass', description: 'agent can use all tools freely — safe in isolated worktrees' },
  { value: 'acceptEdits', label: 'accept edits', description: 'agent can edit files; asks before running bash commands' },
  { value: 'default', label: 'default', description: 'agent asks before any tool that writes or runs code' },
  { value: 'plan', label: 'plan', description: 'agent produces a plan only — no tool calls executed' },
];

interface SessionPermissionsPanelProps {
  readonly taskId: TaskId;
  readonly agentId: SessionId | null;
  readonly workspaceId: WorkspaceId;
  readonly open: boolean;
  readonly onClose: () => void;
}

export function SessionPermissionsPanel({
  taskId,
  workspaceId,
  open,
  onClose,
}: SessionPermissionsPanelProps) {
  const [tab, setTab] = useState<PanelTab>('session-rules');

  const session = useAppStore((s) => s.sessions.find((x) => x.id === taskId));
  const setSessionPermissionMode = useAppStore((s) => s.setSessionPermissionMode);

  if (!open) return null;

  const currentMode = session?.permissionMode ?? 'bypassPermissions';

  return (
    <>
      <div className="fixed inset-0 z-40" aria-hidden onClick={onClose} />
      <div className="fixed right-0 top-0 z-50 flex h-full w-[480px] max-w-full flex-col border-l border-border bg-background shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="text-sm font-semibold">permissions</span>
          <button
            type="button"
            onClick={onClose}
            className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="close permissions panel"
          >
            ✕
          </button>
        </div>

        <div className="flex gap-0.5 border-b border-border px-3 py-2">
          {(Object.keys(TAB_LABELS) as PanelTab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn(
                'rounded px-2.5 py-1 text-xs font-medium transition-colors',
                tab === t
                  ? 'bg-foreground text-background'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {tab === 'session-rules' && (
            <PermissionsPanel scope={{ kind: 'task', id: taskId }} />
          )}
          {tab === 'workspace-rules' && (
            <PermissionsPanel scope={{ kind: 'workspace', id: workspaceId }} />
          )}
          {tab === 'audit' && (
            <AuditContent taskId={taskId} />
          )}
          {tab === 'mode' && (
            <ModeContent
              currentMode={currentMode}
              onModeChange={(mode) => void setSessionPermissionMode(taskId, mode)}
            />
          )}
        </div>
      </div>
    </>
  );
}

function AuditContent({ taskId }: { taskId: TaskId }) {
  return <PermissionAuditPanel taskId={taskId} open onClose={() => undefined} inline />;
}

function ModeContent({
  currentMode,
  onModeChange,
}: {
  currentMode: ClaudePermissionMode;
  onModeChange: (mode: ClaudePermissionMode) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="text-xs font-semibold text-foreground">permission mode</div>
      <p className="text-xs text-muted-foreground">
        takes effect on the next turn. changes to this session only.
      </p>
      <div className="flex flex-col gap-1.5">
        {MODE_OPTIONS.map(({ value, label, description }) => (
          <label
            key={value}
            className={cn(
              'flex cursor-pointer items-start gap-3 rounded-md border p-3 text-xs transition-colors',
              currentMode === value
                ? 'border-foreground/30 bg-subtle'
                : 'border-border-soft hover:border-border hover:bg-subtle/50',
            )}
          >
            <input
              type="radio"
              name="permission-mode"
              value={value}
              checked={currentMode === value}
              onChange={() => onModeChange(value)}
              className="mt-0.5 shrink-0 accent-foreground"
            />
            <div className="flex flex-col gap-0.5">
              <span className="font-semibold text-foreground">{label}</span>
              <span className="text-muted-foreground">{description}</span>
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}
