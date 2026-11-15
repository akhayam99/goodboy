import type { WorkspaceId } from '@goodboy/types';
import { Chip } from '@goodboy/ui';
import { integrationLabel } from '../../../../shared/utils/integrationLabel';
import { useAppStore } from '../../../../store';
import { toolCheckKey } from '../../../../store/slices/integrations/toolCheckKey';
import { toolIdentity } from '../../../integrations/toolIdentity';
import type { ConnectionToolId } from '../../model/connectionState';
import { connectionStateOf } from '../../model/connectionStateOf';
import { lastCheckLineOf } from '../../model/lastCheckLineOf';
import { TOOL_FEEDS } from '../../model/toolFeeds';
import { ConnectionTile } from './ConnectionTile';
import { ToolGlyph } from './ToolGlyph';

type Props = {
  readonly tool: ConnectionToolId;
  readonly workspaceId: WorkspaceId;
  readonly nowMs: number;
  readonly onOpen: () => void;
};

const GITHUB_FALLBACK = 'Signed in with gh';

export const IntegrationTile = ({ tool, workspaceId, nowMs, onOpen }: Props) => {
  const binding = useAppStore((state) =>
    state.workspaceIntegrations[workspaceId]?.find((candidate) => candidate.provider === tool),
  );
  const githubUser = useAppStore(
    (state) => state.githubWorkspaceStatus[workspaceId]?.user ?? state.githubStatus?.user ?? null,
  );
  const check = useAppStore((state) => state.toolLastCheck[toolCheckKey({ workspaceId, tool })]);
  const state = connectionStateOf({ subject: { kind: 'tool', isConnected: true, check } });
  const identity = tool === 'github' ? (githubUser ?? GITHUB_FALLBACK) : toolIdentity({ binding });

  return (
    <ConnectionTile
      id={tool}
      glyph={<ToolGlyph tool={tool} />}
      name={integrationLabel({ provider: tool })}
      state={state}
      onOpen={onOpen}
    >
      <span className="truncate text-meta text-foreground">{identity}</span>
      <span className="flex flex-wrap gap-1">
        {TOOL_FEEDS[tool].map((feed) => (
          <Chip key={feed} tone="neutral" label={feed} bordered />
        ))}
      </span>
      <span className="text-meta text-faint-foreground">{lastCheckLineOf({ check, nowMs })}</span>
    </ConnectionTile>
  );
};
