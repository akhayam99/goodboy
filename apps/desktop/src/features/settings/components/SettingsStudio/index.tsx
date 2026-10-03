import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ScrollFade, StudioRailLayout } from '@goodboy/ui';
import type { Workspace } from '@goodboy/types';
import { ToolSettingsScope } from '../../../integrations/components/ToolSettingsScope';
import { ProviderSettingsScope } from '../../../providers/components/ProviderStudio';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import { StudioShell } from '../../../../shared/components/StudioShell';
import { StudioTrail } from '../../../../shared/components/StudioShell/StudioTrail';
import { settingsTrail } from '../../trail/settingsMenus';
import { AppScopePanel } from './AppScopePanel';
import { SettingsRail } from './SettingsRail';
import { isNestedScope, settingsScopeAvailable, type NestedScope } from './settingsScopes';
import { appSectionOf } from './appSections';
import type { ScopeFrame } from './types';
import type { SettingsFocus, SettingsPageScope, SettingsScopeChange } from '../../settingsFocus';
import { WorkspaceScopePanel } from './WorkspaceScopePanel';
import { useSettingsStatus } from '../../hooks/useSettingsStatus';
import { settingsDirectory, settingsPageKey } from './settingsDirectory';
import { SettingsHome } from './SettingsHome';
import { writeLastSettingsPage } from './lastSettingsPage';

type Props = {
  readonly currentWorkspace: Workspace | null;
  readonly focus: SettingsFocus;
  readonly onScopeChange: (params: SettingsScopeChange) => void;
  readonly onClose: () => void;
};

type Slots = Readonly<Partial<Record<NestedScope, HTMLDivElement>>>;

const NESTED_SCOPES = ['providers', 'tools'] as const satisfies ReadonlyArray<NestedScope>;

const withSlot = ({
  slots,
  scope,
  element,
}: {
  readonly slots: Slots;
  readonly scope: NestedScope;
  readonly element: HTMLDivElement | null;
}): Slots => {
  if ((slots[scope] ?? null) === element) {
    return slots;
  }
  return { ...slots, [scope]: element ?? undefined };
};

const pageScopeOf = ({
  focus,
  hasWorkspace,
}: {
  readonly focus: SettingsFocus;
  readonly hasWorkspace: boolean;
}): SettingsPageScope => {
  if (focus.scope === 'home') {
    return 'app';
  }
  return settingsScopeAvailable({ scope: focus.scope, hasWorkspace }) ? focus.scope : 'app';
};

export const SettingsStudio = ({ currentWorkspace, focus, onScopeChange, onClose }: Props) => {
  const hasWorkspace = currentWorkspace !== null;
  const workspaceId = currentWorkspace?.id ?? null;
  const workspaceName = currentWorkspace?.name ?? null;
  const isHome = focus.scope === 'home';
  const availableScope = pageScopeOf({ focus, hasWorkspace });
  const status = useSettingsStatus({ workspaceId });
  const groups = useMemo(
    () => settingsDirectory({ status, workspaceName }),
    [status, workspaceName],
  );
  const pageKey = isHome
    ? null
    : settingsPageKey({
        scope: availableScope,
        section: focus.section,
        provider: focus.provider,
        tool: focus.tool,
      });

  useEffect(() => {
    if (pageKey === null) {
      return;
    }
    writeLastSettingsPage({ key: pageKey });
  }, [pageKey]);

  const [shownScope, setShownScope] = useState<SettingsPageScope>(availableScope);
  const [leaving, setLeaving] = useState<NestedScope | null>(null);
  const [railSlots, setRailSlots] = useState<Slots>({});
  const [detailSlots, setDetailSlots] = useState<Slots>({});

  if (shownScope !== availableScope) {
    setShownScope(availableScope);
    setLeaving(isNestedScope(shownScope) ? shownScope : null);
  }

  const slotRefs = useMemo(() => {
    const refFor =
      (update: typeof setRailSlots) => (scope: NestedScope) => (element: HTMLDivElement | null) =>
        update((slots) => withSlot({ slots, scope, element }));
    const rail = refFor(setRailSlots);
    const detail = refFor(setDetailSlots);
    return {
      rail: { providers: rail('providers'), tools: rail('tools') },
      detail: { providers: detail('providers'), tools: detail('tools') },
    };
  }, []);

  const frameFor =
    (scope: NestedScope): ScopeFrame =>
    ({ nested, detail }) => {
      const railSlot = railSlots[scope];
      const detailSlot = detailSlots[scope];
      return (
        <>
          {railSlot === undefined ? null : createPortal(nested, railSlot)}
          {scope !== availableScope || detailSlot === undefined
            ? null
            : createPortal(detail, detailSlot)}
        </>
      );
    };

  const renderScope = (scope: NestedScope): ReactNode => {
    if (scope === 'providers') {
      return (
        <ProviderSettingsScope
          key="providers"
          workspaceId={currentWorkspace?.id ?? null}
          initialFocus={focus.provider}
          initialAction={focus.action}
          {...(focus.section != null && { initialSection: focus.section })}
          frame={frameFor('providers')}
        />
      );
    }
    if (currentWorkspace === null) {
      return null;
    }
    return (
      <ToolSettingsScope
        key={`tools:${currentWorkspace.id}`}
        workspaceId={currentWorkspace.id}
        initialFocus={focus.tool}
        frame={frameFor('tools')}
      />
    );
  };

  const renderDetail = (requestClose: () => void): ReactNode => {
    if (isNestedScope(availableScope)) {
      return <div key={availableScope} ref={slotRefs.detail[availableScope]} className="h-full" />;
    }
    if (availableScope === 'workspace' && currentWorkspace !== null) {
      return (
        <WorkspaceScopePanel
          workspaceId={currentWorkspace.id}
          initialSection={focus.section}
          requestClose={requestClose}
        />
      );
    }
    return (
      <AppScopePanel
        section={appSectionOf({ section: focus.section })}
        workspaceId={currentWorkspace?.id ?? null}
        requestClose={requestClose}
      />
    );
  };

  return (
    <StudioShell
      icon={CONCEPT_ICONS.settings}
      tone={CONCEPT_TONE.settings}
      title="Settings"
      closeLabel="close settings"
      onClose={onClose}
    >
      {(requestClose) => (
        <>
          <StudioTrail
            segments={settingsTrail({
              scope: isHome ? 'home' : availableScope,
              appSection: appSectionOf({ section: focus.section }),
              workspaceName,
              onSelect: onScopeChange,
            })}
          />
          {isHome ? (
            <SettingsHome groups={groups} onOpen={(page) => onScopeChange(page.target)} />
          ) : (
            <StudioRailLayout
              railLabel="Settings scopes"
              railWidth="narrow"
              surface="settings"
              rail={
                <ScrollFade className="min-h-0 flex-1" fadeFrom="background">
                  <SettingsRail
                    scope={availableScope}
                    appSection={appSectionOf({ section: focus.section })}
                    groups={groups}
                    nestedSlot={slotRefs.rail}
                    onNestedClosed={({ scope }) =>
                      setLeaving((current) => (current === scope ? null : current))
                    }
                    onSelect={onScopeChange}
                  />
                </ScrollFade>
              }
              detail={renderDetail(requestClose)}
            />
          )}
          {isHome
            ? null
            : NESTED_SCOPES.filter((scope) => scope === availableScope || scope === leaving).map(
                renderScope,
              )}
        </>
      )}
    </StudioShell>
  );
};
