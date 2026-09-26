import { cn, PANE_RHYTHM, StatusRailItem } from '@goodboy/ui';
import type { IntegrationBinding } from '@goodboy/types';
import { FOOTER_INTEGRATIONS } from '../../../../app/components/AppFooter/categories';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import {
  IntegrationGlyph,
  integrationLabel,
  type IntegrationGlyphProvider,
} from '../IntegrationGlyph';
import { toolIdentity } from './toolIdentity';

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
  <ul
    aria-label="Integrations settings"
    className={cn('flex flex-col gap-0.5', PANE_RHYTHM.navRail.nest)}
  >
    {FOOTER_INTEGRATIONS.map(({ provider }) => {
      const subtitle = !connected[provider]
        ? 'not connected'
        : provider === 'github'
          ? (githubIdentity ?? 'connected')
          : toolIdentity({
              binding: integrations.find((binding) => binding.provider === provider),
            });
      return (
        <li key={provider}>
          <StatusRailItem
            icon={<IntegrationGlyph provider={provider} size={ICON_SIZE.control} useBrandColor />}
            label={integrationLabel({ provider })}
            subtitle={subtitle}
            tone={connected[provider] ? 'success' : 'neutral'}
            selected={provider === focusedId}
            onClick={() => onSelect(provider)}
          />
        </li>
      );
    })}
  </ul>
);
