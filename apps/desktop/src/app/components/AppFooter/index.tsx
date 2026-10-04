import { Divider } from '@goodboy/ui';
import type { IntegrationGlyphProvider } from '../../../features/integrations/components/IntegrationGlyph';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../shared/components/conceptIcons';
import { shortcutGlyphs } from '../../../shared/keyboard/registry';
import { FOOTER_INTEGRATIONS } from './categories';
import { FooterButton } from './FooterButton';
import { GoodboyChip } from './GoodboyChip';
import { IntegrationAddPopover } from './IntegrationAddPopover';
import { ProvidersMenu } from './ProvidersMenu';
import { useAppStore } from '../../../store';
import {
  IntegrationGlyph,
  integrationLabel,
} from '../../../features/integrations/components/IntegrationGlyph';
import type { ConnectedIntegrations, FooterTarget } from '../../hooks/useAppOverlays/overlayState';
import type { ShellFooterScope } from '../../shellArrangement';

const SETTINGS_SHORTCUT = shortcutGlyphs('settings.open');

type Props = {
  readonly scope: ShellFooterScope;
  readonly target: FooterTarget;
  readonly connected: ConnectedIntegrations;
  readonly onOpenIntegration: (params: { readonly provider: IntegrationGlyphProvider }) => void;
  readonly onOpenInbox: () => void;
  readonly onOpenWorkflows: () => void;
  readonly onOpenImpact: () => void;
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
  onOpenImpact,
  onOpenSettings,
  onOpenChangelog,
  onOpenShortcuts,
}: Props) => {
  const connectedMembers = FOOTER_INTEGRATIONS.filter((member) => connected[member.provider]);
  const isWorkspace = scope === 'workspace';
  const currentWorkspaceId = useAppStore((state) => state.currentWorkspaceId);

  return (
    <div className="flex shrink-0 flex-col">
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
                      onClick={() => onOpenIntegration({ provider: member.provider })}
                      isCurrent={target.tool === member.provider}
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
                active={target.place === 'link'}
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
                onClick={onOpenInbox}
                isCurrent={target.place === 'inbox' && target.tool === null}
              />
              <FooterButton
                icon={<CONCEPT_ICONS.workflows size={ICON_SIZE.control} aria-hidden />}
                label="Workflows"
                onClick={onOpenWorkflows}
                isCurrent={target.place === 'workflows'}
              />
              <FooterButton
                icon={<CONCEPT_ICONS.impact size={ICON_SIZE.control} aria-hidden />}
                label="Impact"
                onClick={onOpenImpact}
                isCurrent={target.place === 'impact'}
              />
            </>
          )}
          {isWorkspace && currentWorkspaceId !== null ? (
            <ProvidersMenu workspaceId={currentWorkspaceId} />
          ) : null}
          <FooterButton
            icon={<CONCEPT_ICONS.settings size={ICON_SIZE.control} aria-hidden />}
            label="Settings"
            shortcut={SETTINGS_SHORTCUT}
            onClick={onOpenSettings}
            isCurrent={target.place === 'settings'}
          />
        </div>
      </div>
    </div>
  );
};
