import { useRef } from 'react';
import { ArrowRight } from 'lucide-react';
import type { Workspace } from '@goodboy/types';
import {
  Button,
  ICON_SIZE,
  PaneShell,
  RefreshIconButton,
  ScrollFade,
  useScrollMemory,
} from '@goodboy/ui';
import { ProviderGlyph } from '../../../../shared/components/RoutingPicker/ProviderGlyph';
import { useNow } from '../../../../shared/hooks/useNow';
import { integrationLabel } from '../../../../shared/utils/integrationLabel';
import { NAMES } from '../../../../shared/utils/names';
import { useAppStore } from '../../../../store';
import { TOOL_CATALOG } from '../../../integrations/toolCatalog';
import { openSettings } from '../../../settings/openSettings';
import { useConnectionGroups } from '../../hooks/useConnectionGroups';
import { useConnectionsRefresh } from '../../hooks/useConnectionsRefresh';
import { useToolChecks } from '../../hooks/useToolChecks';
import { connectionsSubtitle } from '../../model/connectionsSubtitle';
import { providerSetupLine } from '../../model/providerSetupLine';
import { providerSetupVerb } from '../../model/providerSetupVerb';
import { openConnection } from '../../openConnection';
import { ConnectionsSection } from './ConnectionsSection';
import { IntegrationTile } from './IntegrationTile';
import { ProviderTile } from './ProviderTile';
import { SetupTile } from './SetupTile';
import { ToolGlyph } from './ToolGlyph';

type Props = {
  readonly workspace: Workspace | null;
};

const CLOCK_MS = 60_000;

const PROVIDERS_PLACE = 'This Mac, every workspace';

const NO_WORKSPACE = 'Open a workspace to connect its tools';

const MODELS_LINK = 'Which model each role uses';

export const ConnectionsIndex = ({ workspace }: Props) => {
  const workspaceId = workspace?.id ?? null;
  const nowMs = useNow(CLOCK_MS);
  const providers = useAppStore((state) => state.providers);
  const groups = useConnectionGroups({ workspaceId });
  const { refresh, isRefreshing, error } = useConnectionsRefresh({ workspaceId });
  const checkError = useToolChecks({ workspaceId });
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const onScroll = useScrollMemory({
    memoryKey: `connections:${workspaceId ?? 'none'}`,
    isLoaded: providers.length > 0,
    viewportRef,
  });

  const providerTiles = groups.providers.tiles.map((id) => (
    <ProviderTile
      key={id}
      providerId={id}
      nowMs={nowMs}
      onOpen={() => openConnection({ focus: { kind: 'provider', provider: id } })}
    />
  ));
  const providerSetup = groups.providers.setup.flatMap((id) => {
    const provider = providers.find((candidate) => candidate.id === id);
    const verb = provider === undefined ? null : providerSetupVerb({ provider });
    if (provider === undefined || verb === null) {
      return [];
    }
    return [
      <SetupTile
        key={id}
        id={id}
        glyph={<ProviderGlyph id={id} />}
        name={provider.label}
        verb={verb}
        line={providerSetupLine({ providerId: id, connection: provider.connection })}
        onOpen={() =>
          openConnection({
            focus: {
              kind: 'provider',
              provider: id,
              action: provider.connection === 'missing' ? 'install' : 'login',
            },
          })
        }
      />,
    ];
  });
  const tools = groups.tools;
  const toolTiles =
    workspaceId === null || tools === null
      ? []
      : tools.tiles.map((tool) => (
          <IntegrationTile
            key={tool}
            tool={tool}
            workspaceId={workspaceId}
            nowMs={nowMs}
            onOpen={() => openConnection({ focus: { kind: 'tool', tool } })}
          />
        ));
  const toolSetup =
    tools === null
      ? []
      : tools.setup.map((tool) => (
          <SetupTile
            key={tool}
            id={tool}
            glyph={<ToolGlyph tool={tool} />}
            name={integrationLabel({ provider: tool })}
            verb="Connect"
            line={TOOL_CATALOG.find((entry) => entry.provider === tool)?.connectedLabel ?? ''}
            onOpen={() => openConnection({ focus: { kind: 'tool', tool } })}
          />
        ));

  return (
    <PaneShell
      page="connections"
      scroll="body"
      title={NAMES.connections}
      meta={connectionsSubtitle({ groups, workspaceName: workspace?.name ?? null })}
      actions={
        <RefreshIconButton
          label="Refresh connections"
          onClick={refresh}
          isLoading={isRefreshing}
          error={error ?? checkError}
        />
      }
    >
      <ScrollFade
        viewportClassName="flex flex-col gap-8 pb-6"
        viewportRef={viewportRef}
        onViewportScroll={onScroll}
      >
        <ConnectionsSection
          id="providers"
          label={NAMES.providers}
          place={PROVIDERS_PLACE}
          action={
            <Button variant="ghost" size="sm" onClick={() => openSettings({ scope: 'providers' })}>
              {MODELS_LINK}
              <ArrowRight size={ICON_SIZE.row} aria-hidden />
            </Button>
          }
          tiles={providerTiles}
          setup={providerSetup}
          empty={null}
        />
        <ConnectionsSection
          id="tools"
          label="Integrations"
          place={workspace === null ? 'No workspace open' : `${workspace.name} workspace`}
          tiles={toolTiles}
          setup={toolSetup}
          empty={workspace === null ? NO_WORKSPACE : null}
        />
      </ScrollFade>
    </PaneShell>
  );
};
