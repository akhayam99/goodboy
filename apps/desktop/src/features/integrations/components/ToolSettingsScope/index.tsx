import { useEffect, useState } from 'react';
import type { WorkspaceId } from '@goodboy/types';
import { FOOTER_INTEGRATIONS } from '../../../../app/components/AppFooter/categories';
import type { IntegrationGlyphProvider } from '../IntegrationGlyph';
import { useToolConnections } from '../../useToolConnections';
import type { ScopeFrame } from '../../../settings/components/SettingsStudio/types';
import { ToolsRail } from './ToolsRail';
import { ToolDetailPanel } from './ToolDetailPanel';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly initialFocus?: IntegrationGlyphProvider;
  readonly frame: ScopeFrame;
};

export const ToolSettingsScope = ({ workspaceId, initialFocus, frame }: Props) => {
  const { integrations, connected, github, githubIdentity } = useToolConnections({ workspaceId });
  const [focused, setFocused] = useState<IntegrationGlyphProvider | null>(initialFocus ?? null);
  useEffect(() => setFocused(initialFocus ?? null), [initialFocus]);
  const defaultSelection =
    focused ??
    FOOTER_INTEGRATIONS.find(({ provider }) => !connected[provider])?.provider ??
    FOOTER_INTEGRATIONS[0]?.provider ??
    'github';

  const selected = github.isResolved ? defaultSelection : null;

  useEffect(() => {
    if (focused === null && selected !== null) {
      setFocused(selected);
    }
  }, [focused, selected]);

  return frame({
    nested: (
      <ToolsRail
        focusedId={selected}
        onSelect={setFocused}
        integrations={integrations}
        connected={connected}
        githubIdentity={githubIdentity}
      />
    ),
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
