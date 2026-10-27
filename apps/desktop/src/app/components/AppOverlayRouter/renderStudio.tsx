import type { ReactNode } from 'react';
import { lazyNamed } from '../../../shared/lib/lazyNamed';
import type { RenderStudioParams } from './studioParams';

const SettingsStudio = lazyNamed({
  load: () => import('../../../features/settings/components/SettingsStudio'),
  pick: ({ SettingsStudio }) => SettingsStudio,
});
const GuideStudio = lazyNamed({
  load: () => import('../../../features/settings/components/GuideStudio'),
  pick: ({ GuideStudio }) => GuideStudio,
});
const WorkspaceLinkStudio = lazyNamed({
  load: () => import('../../../features/workspace/components/WorkspaceLinkStudio'),
  pick: ({ WorkspaceLinkStudio }) => WorkspaceLinkStudio,
});
const WorkflowStudio = lazyNamed({
  load: () => import('../../../features/workflows/components/WorkflowStudio'),
  pick: ({ WorkflowStudio }) => WorkflowStudio,
});
const InboxStudio = lazyNamed({
  load: () => import('../../../features/inbox/components/InboxStudio'),
  pick: ({ InboxStudio }) => InboxStudio,
});
const ImpactStudio = lazyNamed({
  load: () => import('../../../features/impact/components/ImpactStudio'),
  pick: ({ ImpactStudio }) => ImpactStudio,
});
const ChangelogStudio = lazyNamed({
  load: () => import('../../../features/changelog/components/ChangelogStudio'),
  pick: ({ ChangelogStudio }) => ChangelogStudio,
});
const NotificationsStudio = lazyNamed({
  load: () => import('../../../features/notifications/components/NotificationsStudio'),
  pick: ({ NotificationsStudio }) => NotificationsStudio,
});
const ChatStudio = lazyNamed({
  load: () => import('../../../features/workspace-chat/components/ChatStudio'),
  pick: ({ ChatStudio }) => ChatStudio,
});
const TerminalStudio = lazyNamed({
  load: () => import('../../../features/terminal/components/TerminalStudio'),
  pick: ({ TerminalStudio }) => TerminalStudio,
});
const MonitoringStudio = lazyNamed({
  load: () => import('../../../features/monitoring/components/MonitoringStudio'),
  pick: ({ MonitoringStudio }) => MonitoringStudio,
});

export const renderStudio = ({
  overlay,
  close,
  onSettingsScopeChange,
  onInboxFocusChange,
  onImpactScopeChange,
  onOpenChangelogScreen,
  currentWorkspace,
  workspaceProjectRoot,
  settingsColumnSlot = null,
  isInColumnShell,
}: RenderStudioParams): ReactNode => {
  switch (overlay.kind) {
    case 'settings':
      return (
        <SettingsStudio
          currentWorkspace={currentWorkspace}
          focus={overlay.focus}
          onScopeChange={onSettingsScopeChange}
          onClose={close}
          columnSlot={settingsColumnSlot}
          isInColumnShell={isInColumnShell}
        />
      );
    case 'guide':
      return <GuideStudio onClose={close} />;
    case 'addWorkspace':
      return <WorkspaceLinkStudio onClose={close} />;
    case 'workflow':
      return currentWorkspace === null ? null : (
        <WorkflowStudio workspaceId={currentWorkspace.id} onClose={close} />
      );
    case 'inbox':
      return currentWorkspace === null ? null : (
        <InboxStudio
          workspaceId={currentWorkspace.id}
          rootPath={workspaceProjectRoot ?? ''}
          initialProvider={overlay.focus?.provider ?? null}
          initialKind={overlay.focus?.kind ?? null}
          initialRecordKey={overlay.focus?.recordKey ?? null}
          initialSessionId={overlay.focus?.sessionId ?? null}
          onFocusChange={onInboxFocusChange}
          onClose={close}
        />
      );
    case 'impact':
      return currentWorkspace === null ? null : (
        <ImpactStudio
          workspaceId={currentWorkspace.id}
          initialScope={overlay.scope ?? undefined}
          onScopeChange={onImpactScopeChange}
          onClose={close}
        />
      );
    case 'changelog':
      return currentWorkspace === null ? null : (
        <ChangelogStudio onClose={close} onOpenScreen={onOpenChangelogScreen} />
      );
    case 'notifications':
      return currentWorkspace === null ? null : <NotificationsStudio onClose={close} />;
    case 'chat':
      return currentWorkspace === null ? null : (
        <ChatStudio workspaceId={currentWorkspace.id} chatId={overlay.chatId} onClose={close} />
      );
    case 'terminal':
      return currentWorkspace === null ? null : (
        <TerminalStudio
          workspaceId={currentWorkspace.id}
          terminalId={overlay.terminalId}
          sessionId={overlay.sessionId}
          worktree={overlay.worktree ?? null}
          onClose={close}
        />
      );
    case 'monitoring':
      return currentWorkspace === null ? null : <MonitoringStudio onClose={close} />;
    default: {
      const unreachable: never = overlay;
      return unreachable;
    }
  }
};
