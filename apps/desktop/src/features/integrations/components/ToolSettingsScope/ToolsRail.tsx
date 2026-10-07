import type { IntegrationBinding } from '@goodboy/types';
import { FOOTER_INTEGRATIONS } from '../../../../app/components/AppFooter/categories';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { SettingsNavRow } from '../../../../shared/components/SettingsNavRow';
import {
  IntegrationGlyph,
  integrationLabel,
  type IntegrationGlyphProvider,
} from '../IntegrationGlyph';
import { toolRailSubtitle } from '../../toolRailEntries';

type Props = {
  readonly focusedId: IntegrationGlyphProvider | null;
  readonly onSelect: (tool: IntegrationGlyphProvider) => void;
  readonly integrations: ReadonlyArray<IntegrationBinding>;
  readonly connected: Record<IntegrationGlyphProvider, boolean>;
  readonly githubIdentity: string | null;
};

export const ToolsRail = ({
  focusedId,
  onSelect,
  integrations,
  connected,
  githubIdentity,
}: Props) => (
  <ul aria-label="Integrations settings" className="flex flex-col gap-0.5">
    {FOOTER_INTEGRATIONS.map(({ provider }) => {
      const subtitle = toolRailSubtitle({ provider, integrations, connected, githubIdentity });
      return (
        <li key={provider}>
          <SettingsNavRow
            level="page"
            icon={<IntegrationGlyph provider={provider} size={ICON_SIZE.row} useBrandColor />}
            label={integrationLabel({ provider })}
            isCurrent={provider === focusedId}
            status={connected[provider] ? { tone: 'success', label: subtitle } : null}
            onClick={() => onSelect(provider)}
          />
        </li>
      );
    })}
  </ul>
);
