import { useMemo } from 'react';
import type { PermissionRule, ProviderId, TaskId, WorkspaceId } from '@kay-am/types';
import { buildClaudeFlags } from '@kay-am/core';

interface PreflightPillProps {
  readonly provider: ProviderId;
  readonly rules: ReadonlyArray<PermissionRule>;
  readonly taskId: TaskId;
  readonly workspaceId: WorkspaceId;
}

export function PreflightPill({ provider, rules, taskId, workspaceId }: PreflightPillProps) {
  const flags = useMemo(
    () =>
      provider === 'anthropic' ? buildClaudeFlags({ rules, scope: { taskId, workspaceId } }) : null,
    [provider, rules, taskId, workspaceId],
  );

  const openSettings = () => {
    window.dispatchEvent(
      new CustomEvent('kayam:open-settings', { detail: { section: 'permissions' } }),
    );
  };

  if (provider !== 'anthropic') {
    return (
      <button
        type="button"
        onClick={openSettings}
        title="permission proxy currently covers claude only."
        className="self-start rounded-full bg-subtle px-2 py-0.5 text-2xs text-muted-foreground hover:bg-muted"
      >
        permission proxy: claude only
      </button>
    );
  }

  if (!flags) return null;

  const { allowedTools, disallowedTools } = flags;
  const tooltipLines = [
    allowedTools.length > 0 ? `--allowedTools "${allowedTools.join(' ')}"` : null,
    disallowedTools.length > 0 ? `--disallowedTools "${disallowedTools.join(' ')}"` : null,
  ]
    .filter(Boolean)
    .join('\n');

  return (
    <button
      type="button"
      onClick={openSettings}
      title={tooltipLines || 'no permission rules configured'}
      className="self-start rounded-full bg-subtle px-2 py-0.5 text-2xs text-muted-foreground hover:bg-muted"
    >
      permissions: {allowedTools.length} allow / {disallowedTools.length} deny
    </button>
  );
}
