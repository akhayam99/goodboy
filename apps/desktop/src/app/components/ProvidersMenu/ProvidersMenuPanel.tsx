import { ArrowUpRight } from 'lucide-react';
import type { WorkspaceId } from '@goodboy/types';
import { ROW_INTERACTIVE, cn, EmptyLine, Eyebrow, tintClasses } from '@goodboy/ui';
import { CONCEPT_ICONS, CONCEPT_TONE, ICON_SIZE } from '../../../shared/components/conceptIcons';
import { ProviderGlyph } from '../../../shared/components/RoutingPicker/ProviderGlyph';
import { ProviderPolicyList } from '../../../features/providers/components/ProviderPolicyList';
import { openProviderConnect } from '../../../features/providers/openProviderConnect';
import { openProviderUsage } from '../../../features/providers/openProviderUsage';
import { PROVIDER_LABEL } from '../../../features/providers/providerLabel';
import { useProvidersConnection } from '../../hooks/useProvidersConnection';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly onClose: () => void;
};

export const ProvidersMenuPanel = ({ workspaceId, onClose }: Props) => {
  const { connectionOf, connected, missing } = useProvidersConnection();
  return (
    <>
      {connected.length > 0 ? (
        <>
          <div className="flex flex-col px-2">
            <Eyebrow label="This workspace" />
          </div>
          <div className="px-1">
            <ProviderPolicyList workspaceId={workspaceId} />
          </div>
        </>
      ) : (
        <EmptyLine className="px-2">No provider is connected yet.</EmptyLine>
      )}
      <ul aria-label="Provider actions" className="flex flex-col px-1 pt-1">
        {missing.map((id) => (
          <li key={id}>
            <button
              type="button"
              onClick={() => {
                onClose();
                openProviderConnect({ providerId: id, connection: connectionOf({ id }) });
              }}
              className={cn(
                'flex w-full items-center gap-2 rounded-md px-2 py-1 text-label text-foreground',
                ROW_INTERACTIVE,
              )}
            >
              <ProviderGlyph id={id} size={ICON_SIZE.control} />
              <span className="flex-1 text-left">Connect {PROVIDER_LABEL[id]}</span>
              <span className="text-meta text-faint-foreground">Not connected</span>
            </button>
          </li>
        ))}
        <li>
          <button
            type="button"
            onClick={() => {
              onClose();
              openProviderUsage({ providerId: null });
            }}
            className={cn(
              'flex w-full items-center gap-2 rounded-md px-2 py-1 text-label text-foreground',
              ROW_INTERACTIVE,
            )}
          >
            <CONCEPT_ICONS.settings
              size={ICON_SIZE.row}
              aria-hidden
              className={tintClasses(CONCEPT_TONE.settings).icon}
            />
            <span className="flex-1 text-left">Manage providers</span>
            <ArrowUpRight size={ICON_SIZE.row} aria-hidden className="text-faint-foreground" />
          </button>
        </li>
      </ul>
    </>
  );
};
