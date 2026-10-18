import { useEffect, useState } from 'react';
import type { WorkspaceId } from '@goodboy/types';
import { TOOL_CATALOG } from '../../toolCatalog';
import type { IntegrationGlyphProvider } from '../IntegrationGlyph';
import { useToolConnections } from '../../useToolConnections';
import type { ScopeFrame } from '../../../settings/components/SettingsStudio/types';
import { ToolDetailPanel } from './ToolDetailPanel';

type DefaultToolParams = {
  readonly tool: IntegrationGlyphProvider;
};

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly initialFocus?: IntegrationGlyphProvider;
  readonly frame: ScopeFrame;
  readonly onDefaultTool?: (params: DefaultToolParams) => void;
};

export const ToolSettingsScope = ({ workspaceId, initialFocus, frame, onDefaultTool }: Props) => {
  const { integrations, connected, github, githubIdentity } = useToolConnections({ workspaceId });
  const [focused, setFocused] = useState<IntegrationGlyphProvider | null>(initialFocus ?? null);
  useEffect(() => setFocused(initialFocus ?? null), [initialFocus]);
  const defaultSelection =
    focused ??
    TOOL_CATALOG.find(({ provider }) => !connected[provider])?.provider ??
    TOOL_CATALOG[0]?.provider ??
    'github';

  const selected = github.isResolved ? defaultSelection : null;

  useEffect(() => {
    if (focused === null && selected !== null) {
      setFocused(selected);
      onDefaultTool?.({ tool: selected });
    }
  }, [focused, selected, onDefaultTool]);

  return frame({
    detail:
      selected === null ? null : (
        <ToolDetailPanel
          key={selected}
          workspaceId={workspaceId}
          provider={selected}
          isConnected={connected[selected]}
          github={github}
          githubIdentity={githubIdentity}
          binding={integrations.find((binding) => binding.provider === selected)}
        />
      ),
  });
};
