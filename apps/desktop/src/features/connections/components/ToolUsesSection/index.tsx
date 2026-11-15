import { Band } from '@goodboy/ui';
import type { WorkspaceId } from '@goodboy/types';
import type { IntegrationGlyphProvider } from '../../../../shared/components/IntegrationGlyph';
import { dispatchWindowEvent } from '../../../../shared/lib/dispatchWindowEvent';
import { toolUseRowsOf, type ToolUseSource } from '../../model/toolUseRowsOf';
import { ToolSection } from '../IntegrationDetail/ToolSection';
import { ToolUseRow } from './ToolUseRow';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly workspaceName: string;
  readonly tool: IntegrationGlyphProvider;
  readonly label: string;
  readonly isPaused: boolean;
  readonly onOpenChannels: () => void;
};

type OpenParams = {
  readonly workspaceId: WorkspaceId;
  readonly tool: IntegrationGlyphProvider;
  readonly source: ToolUseSource;
  readonly onOpenChannels: () => void;
};

const openUse = ({ workspaceId, tool, source, onOpenChannels }: OpenParams): void => {
  if (source.kind === 'channels') {
    onOpenChannels();
    return;
  }
  dispatchWindowEvent({
    name: 'goodboy:open-inbox',
    detail: { provider: tool, kind: source.inboxKind, workspaceId },
  });
};

export const ToolUsesSection = ({
  workspaceId,
  workspaceName,
  tool,
  label,
  isPaused,
  onOpenChannels,
}: Props) => (
  <ToolSection label={`In ${workspaceName}`} meta={`What ${label} does for this workspace`}>
    <Band>
      {toolUseRowsOf({ tool }).map((row) => (
        <ToolUseRow
          key={row.key}
          workspaceId={workspaceId}
          tool={tool}
          row={row}
          isPaused={isPaused}
          onOpen={() => openUse({ workspaceId, tool, source: row.source, onOpenChannels })}
        />
      ))}
    </Band>
  </ToolSection>
);
