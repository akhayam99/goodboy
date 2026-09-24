import { useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ScrollFade, StudioRailLayout } from '@goodboy/ui';
import type { Workspace } from '@goodboy/types';
import { ToolSettingsScope } from '../../../integrations/components/ToolSettingsScope';
import { ProviderSettingsScope } from '../../../providers/components/ProviderStudio';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import { StudioShell } from '../../../../shared/components/StudioShell';
import { AppScopePanel } from './AppScopePanel';
import {
  SettingsRail,
  isNestedScope,
  settingsScopeAvailable,
  type NestedScope,
} from './SettingsRail';
import { appSectionOf } from './appSections';
import type { ScopeFrame, SettingsFocus, SettingsScopeChange, SettingsStudioScope } from './types';
import { WorkspaceScopePanel } from './WorkspaceScopePanel';

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

export const SettingsStudio = ({ currentWorkspace, focus, onScopeChange, onClose }: Props) => {
  const hasWorkspace = currentWorkspace !== null;
  const availableScope = settingsScopeAvailable({ scope: focus.scope, hasWorkspace })
    ? focus.scope
    : 'app';
  const [shownScope, setShownScope] = useState<SettingsStudioScope>(availableScope);
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
          <StudioRailLayout
            railLabel="Settings scopes"
            railWidth="narrow"
            rail={
              <ScrollFade className="min-h-0 flex-1" fadeFrom="background">
                <SettingsRail
                  scope={availableScope}
                  appSection={appSectionOf({ section: focus.section })}
                  workspaceName={currentWorkspace?.name ?? null}
                  hasWorkspace={hasWorkspace}
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
          {NESTED_SCOPES.filter((scope) => scope === availableScope || scope === leaving).map(
            renderScope,
          )}
        </>
      )}
    </StudioShell>
  );
};
