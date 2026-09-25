import { Divider } from '@goodboy/ui';
import type { IntegrationGlyphProvider } from '../../../features/integrations/components/IntegrationGlyph';
import { CONCEPT_ICONS, CONCEPT_TONE, ICON_SIZE } from '../../../shared/components/conceptIcons';
import { shortcutGlyphs } from '../../../shared/keyboard/registry';
import { FOOTER_INTEGRATIONS } from './categories';
import { FooterButton } from './FooterButton';
import { GoodboyChip } from './GoodboyChip';
import { IntegrationAddPopover } from './IntegrationAddPopover';
import {
  IntegrationGlyph,
  integrationLabel,
} from '../../../features/integrations/components/IntegrationGlyph';
import type { ConnectedIntegrations, FooterTarget } from '../../hooks/useAppOverlays/overlayState';
import type { ShellFooterScope } from '../../shellArrangement';

const SETTINGS_LABEL = `Open settings (${shortcutGlyphs('settings.open')})`;

type Props = {
  readonly scope: ShellFooterScope;
  readonly target: FooterTarget;
  readonly connected: ConnectedIntegrations;
  readonly onOpenIntegration: (params: { readonly provider: IntegrationGlyphProvider }) => void;
  readonly onOpenInbox: () => void;
  readonly onOpenWorkflows: () => void;
  readonly onOpenSettings: () => void;
  readonly onOpenChangelog: () => void;
  readonly onOpenShortcuts: () => void;
};

export const AppFooter = ({
  scope,
  target,
  connected,
  onOpenIntegration,
  onOpenInbox,
  onOpenWorkflows,
  onOpenSettings,
  onOpenChangelog,
  onOpenShortcuts,
}: Props) => {
  const connectedMembers = FOOTER_INTEGRATIONS.filter((member) => connected[member.provider]);
  const isWorkspace = scope === 'workspace';

  return (
    <div className="flex shrink-0 flex-col">
      <Divider />
      <div className="@container/footer grid h-9 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 bg-chrome px-2 [&>*:last-child]:justify-self-end">
        <div className="flex min-w-0 items-center gap-2 overflow-hidden">
          {isWorkspace && (
            <>
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
            </>
          )}
        </div>

        <div className="flex items-center">
          <GoodboyChip onOpenChangelog={onOpenChangelog} onOpenShortcuts={onOpenShortcuts} />
        </div>

        <div className="flex items-center gap-0.5">
          {isWorkspace && (
            <>
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
            </>
          )}
          <FooterButton
            icon={<CONCEPT_ICONS.settings size={ICON_SIZE.control} aria-hidden />}
            label="Settings"
            tone={CONCEPT_TONE.settings}
            title={SETTINGS_LABEL}
            onClick={onOpenSettings}
            active={target === 'settings'}
          />
        </div>
      </div>
    </div>
  );
};
