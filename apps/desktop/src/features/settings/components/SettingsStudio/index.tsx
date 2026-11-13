import { useEffect, useEffectEvent, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { StudioRailPlacement } from '@goodboy/ui';
import type { ProviderId, Workspace } from '@goodboy/types';
import { ToolSettingsScope } from '../../../integrations/components/ToolSettingsScope';
import { ProviderSettingsScope } from '../../../providers/components/ProviderStudio';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import { StudioDetail } from '../../../../shared/components/StudioShell/StudioDetail';
import { StudioShell } from '../../../../shared/components/StudioShell';
import { useAppStore } from '../../../../store';
import { AppScopePanel } from './AppScopePanel';
import { SettingsScopesLayout } from './SettingsScopesLayout';
import { isNestedScope, settingsScopeAvailable, type NestedScope } from './settingsScopes';
import { appSectionOf } from './appSections';
import type { ScopeFrame } from './types';
import type { SettingsFocus, SettingsPageScope, SettingsScopeChange } from '../../settingsFocus';
import { WorkspaceScopePanel } from './WorkspaceScopePanel';
import { useSettingsStatus } from '../../hooks/useSettingsStatus';
import { settingsDirectory, settingsPageKey, type SettingsGroup } from './settingsDirectory';
import { pageFocusOf, resolveSettingsFocus } from './resolveSettingsFocus';

type Props = {
  readonly currentWorkspace: Workspace | null;
  readonly focus: SettingsFocus;
  readonly onScopeChange: (params: SettingsScopeChange) => void;
  readonly onClose: () => void;
  readonly railPlacement?: StudioRailPlacement;
};

type Slots = Readonly<Partial<Record<NestedScope, HTMLDivElement>>>;

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

type SamePageParams = {
  readonly left: SettingsFocus;
  readonly right: SettingsFocus;
};

const isSamePage = ({ left, right }: SamePageParams): boolean =>
  left.scope === right.scope && left.section === right.section;

type LandingParams = {
  readonly groups: ReadonlyArray<SettingsGroup>;
  readonly hasWorkspace: boolean;
};

const landingProviderOf = ({ groups, hasWorkspace }: LandingParams): ProviderId | undefined => {
  if (hasWorkspace) {
    return undefined;
  }
  return groups.find((group) => group.scope === 'providers')?.pages[0]?.target.provider;
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

export const SettingsStudio = ({
  currentWorkspace,
  focus: requestedFocus,
  onScopeChange,
  onClose,
  railPlacement = 'chrome',
}: Props) => {
  const hasWorkspace = currentWorkspace !== null;
  const workspaceId = currentWorkspace?.id ?? null;
  const workspaceName = currentWorkspace?.name ?? null;
  const status = useSettingsStatus({ workspaceId });
  const groups = useMemo(
    () => settingsDirectory({ status, workspaceName }),
    [status, workspaceName],
  );
  const lastFocus = useAppStore((state) => state.lastSettingsFocus);
  const rememberFocus = useAppStore((state) => state.rememberSettingsFocus);
  const focus = resolveSettingsFocus({ focus: requestedFocus, last: lastFocus, groups });
  const isRedirect = !isSamePage({ left: focus, right: requestedFocus });
  const availableScope = pageScopeOf({ focus, hasWorkspace });
  const provider = focus.provider ?? landingProviderOf({ groups, hasWorkspace });
  const pageKey = settingsPageKey({
    scope: availableScope,
    section: focus.section,
    provider,
    tool: focus.tool,
  });

  const redirect = useEffectEvent(() => onScopeChange(focus));
  const rememberPage = useEffectEvent(() =>
    rememberFocus(pageFocusOf({ scope: availableScope, focus })),
  );

  useEffect(() => {
    if (isRedirect) {
      redirect();
    }
  }, [isRedirect]);

  useEffect(() => {
    rememberPage();
  }, [pageKey]);

  const [detailSlots, setDetailSlots] = useState<Slots>({});

  const detailRefs = useMemo(() => {
    const refFor = (scope: NestedScope) => (element: HTMLDivElement | null) =>
      setDetailSlots((slots) => withSlot({ slots, scope, element }));
    return { providers: refFor('providers'), tools: refFor('tools') };
  }, []);

  const frameFor =
    (scope: NestedScope): ScopeFrame =>
    ({ detail }) => {
      const detailSlot = detailSlots[scope];
      return scope !== availableScope || detailSlot === undefined
        ? null
        : createPortal(detail, detailSlot);
    };

  const renderScope = (scope: NestedScope): ReactNode => {
    if (scope === 'providers') {
      return (
        <ProviderSettingsScope
          key="providers"
          workspaceId={currentWorkspace?.id ?? null}
          initialFocus={provider}
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
        onDefaultTool={({ tool }) => onScopeChange({ scope: 'tools', tool })}
      />
    );
  };

  const renderDetail = (requestClose: () => void): ReactNode => {
    if (isNestedScope(availableScope)) {
      return <div key={availableScope} ref={detailRefs[availableScope]} className="h-full" />;
    }
    if (availableScope === 'workspace' && currentWorkspace !== null) {
      return (
        <WorkspaceScopePanel
          key={`workspace:${focus.flow ?? ''}`}
          workspaceId={currentWorkspace.id}
          section={focus.section}
          initialFlow={focus.flow}
          requestClose={requestClose}
        />
      );
    }
    return (
      <AppScopePanel
        section={appSectionOf({ section: focus.section })}
        workspaceId={currentWorkspace?.id ?? null}
      />
    );
  };

  const nested = isNestedScope(availableScope) ? renderScope(availableScope) : null;

  return (
    <StudioShell
      icon={CONCEPT_ICONS.settings}
      tone={CONCEPT_TONE.settings}
      title="Settings"
      onClose={onClose}
    >
      {(requestClose) => (
        <>
          <div className="relative flex min-h-0 min-w-0 flex-1">
            <SettingsScopesLayout
              pageKey={pageKey}
              groups={groups}
              workspaceName={workspaceName}
              onScopeChange={onScopeChange}
              placement={railPlacement}
              detail={
                <StudioDetail>
                  <div data-settings-detail="" className="h-full min-h-0 min-w-0">
                    {renderDetail(requestClose)}
                  </div>
                </StudioDetail>
              }
            />
          </div>
          {nested}
        </>
      )}
    </StudioShell>
  );
};
