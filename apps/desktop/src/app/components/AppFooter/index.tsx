import { Divider } from '@goodboy/ui';
import { useAppStore } from '../../../store';
import type { IntegrationGlyphProvider } from '../../../features/integrations/components/IntegrationGlyph';
import { UpdateIndicator } from '../../../features/updater/components/UpdateIndicator';
import { BetaPill } from '../../../shared/components/BetaPill';
import { CONCEPT_ICONS, CONCEPT_TONE, ICON_SIZE } from '../../../shared/components/conceptIcons';
import { shortcutGlyphs } from '../../../shared/keyboard/registry';
import { FOOTER_INTEGRATIONS } from './categories';
import { FooterButton } from './FooterButton';
import { IntegrationAddPopover } from './IntegrationAddPopover';
import {
  IntegrationGlyph,
  integrationLabel,
} from '../../../features/integrations/components/IntegrationGlyph';
import { MoreStudiosPopover } from './MoreStudiosPopover';
import type { ConnectedIntegrations, FooterTarget } from '../../hooks/useAppOverlays/overlayState';

const SETTINGS_LABEL = `Open settings (${shortcutGlyphs('settings.open')})`;

type Props = {
  readonly target: FooterTarget;
  readonly connected: ConnectedIntegrations;
  readonly onOpenIntegration: (params: { readonly provider: IntegrationGlyphProvider }) => void;
  readonly onOpenInbox: () => void;
  readonly onOpenWorkflows: () => void;
  readonly onOpenProviders: () => void;
  readonly onOpenSettings: () => void;
  readonly onOpenImpact: () => void;
  readonly onOpenChangelog: () => void;
};

export const AppFooter = ({
  target,
  connected,
  onOpenIntegration,
  onOpenInbox,
  onOpenWorkflows,
  onOpenProviders,
  onOpenSettings,
  onOpenImpact,
  onOpenChangelog,
}: Props) => {
  const noProviderConnected = useAppStore(
    (s) => !s.providers.some((p) => p.connection === 'connected'),
  );
  const connectedMembers = FOOTER_INTEGRATIONS.filter((member) => connected[member.provider]);

  return (
    <div className="flex shrink-0 flex-col">
      <Divider />
      <div className="grid h-9 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 bg-background px-2 [&>*:last-child]:justify-self-end">
        <div className="flex min-w-0 items-center gap-2 overflow-hidden">
          <div
            role="group"
            aria-label="Connected integrations"
            className="flex min-w-0 items-center gap-0.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {connectedMembers.map((member) => {
              const label = integrationLabel({ provider: member.provider });
              return (
                <FooterButton
                  key={member.provider}
                  icon={<IntegrationGlyph provider={member.provider} size="xs" useBrandColor />}
                  label={label}
                  title={label}
                  onClick={() => onOpenIntegration({ provider: member.provider })}
                  active={target === member.provider}
                  showLabel={false}
                />
              );
            })}
          </div>
          {connectedMembers.length > 0 ? (
            <Divider orientation="vertical" className="h-4 shrink-0 self-center" />
          ) : null}
          <IntegrationAddPopover
            members={FOOTER_INTEGRATIONS}
            connected={connected}
            onOpenIntegration={onOpenIntegration}
            isEmpty={connectedMembers.length === 0}
            active={target === 'link'}
          />
        </div>

        <div className="flex items-center gap-2">
          <BetaPill />
          <UpdateIndicator variant="pip" onOpenChangelog={onOpenChangelog} />
        </div>

        <div className="flex items-center gap-0.5">
          <FooterButton
            icon={<CONCEPT_ICONS.inbox size={ICON_SIZE.control} aria-hidden />}
            label="Inbox"
            tone={CONCEPT_TONE.inbox}
            title="Open the inbox for this workspace"
            onClick={onOpenInbox}
            active={target === 'inbox'}
          />
          <FooterButton
            icon={<CONCEPT_ICONS.workflows size={ICON_SIZE.control} aria-hidden />}
            label="Workflows"
            tone={CONCEPT_TONE.workflows}
            title="Open the workflow library for this workspace"
            onClick={onOpenWorkflows}
            active={target === 'workflows'}
          />
          <FooterButton
            icon={<CONCEPT_ICONS.providers size={ICON_SIZE.control} aria-hidden />}
            label="Providers"
            tone={CONCEPT_TONE.providers}
            title="Connect and manage your provider accounts"
            onClick={onOpenProviders}
            pulse={noProviderConnected && target !== 'providers'}
            active={target === 'providers'}
          />
          <FooterButton
            icon={<CONCEPT_ICONS.settings size={ICON_SIZE.control} aria-hidden />}
            label="Settings"
            tone={CONCEPT_TONE.settings}
            title={SETTINGS_LABEL}
            onClick={onOpenSettings}
            active={target === 'settings'}
          />
          <MoreStudiosPopover
            target={target}
            openers={{
              impact: onOpenImpact,
              changelog: onOpenChangelog,
            }}
          />
        </div>
      </div>
    </div>
  );
};
