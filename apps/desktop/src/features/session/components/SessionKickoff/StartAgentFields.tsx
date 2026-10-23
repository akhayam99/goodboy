import { useShallow } from 'zustand/react/shallow';
import type { WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { selectSessionDraft } from '../../../../store/slices/sessionDraft/selectSessionDraft';
import { ModelControlChip } from '../../../../shared/components/ModelControlChip';
import { useWorkspaceKindRouting } from '../../../../shared/hooks/useWorkspaceKindRouting';
import { StartRoleField } from './StartRoleField';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly isDisabled: boolean;
};

export const StartAgentFields = ({ workspaceId, isDisabled }: Props) => {
  const kind = useAppStore((state) => selectSessionDraft({ state, workspaceId }).agentKind);
  const routing = useAppStore((state) => selectSessionDraft({ state, workspaceId }).agentRouting);
  const patchSessionDraft = useAppStore((state) => state.patchSessionDraft);
  const connectedProviders = useAppStore(
    useShallow((state) =>
      state.providers
        .filter((provider) => provider.connection === 'connected')
        .map((provider) => provider.id),
    ),
  );
  const suggestion = useWorkspaceKindRouting({ workspaceId, kind });
  const effective = routing ?? suggestion;

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <StartRoleField
        value={kind}
        isDisabled={isDisabled}
        onChange={(next) =>
          patchSessionDraft({ workspaceId, patch: { agentKind: next, agentRouting: null } })
        }
      />
      <ModelControlChip
        connectedProviders={connectedProviders}
        effective={effective}
        suggestion={suggestion}
        isOverridden={routing !== null}
        isDisabled={isDisabled}
        onChange={(route) =>
          patchSessionDraft({
            workspaceId,
            patch: {
              agentRouting:
                route === null || route.provider === ''
                  ? null
                  : { ...effective, ...route, provider: route.provider },
            },
          })
        }
      />
    </div>
  );
};
