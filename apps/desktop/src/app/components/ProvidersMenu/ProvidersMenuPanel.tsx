import { ArrowUpRight } from 'lucide-react';
import type { WorkspaceId } from '@goodboy/types';
import { EmptyLine, Eyebrow, ICON_SIZE, SelectableRow, tintClasses } from '@goodboy/ui';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../shared/components/conceptIcons';
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
            <SelectableRow
              selected={false}
              onClick={() => {
                onClose();
                openProviderConnect({ providerId: id, connection: connectionOf({ id }) });
              }}
              className="items-center gap-2 px-2 py-1 text-meta text-foreground"
            >
              <ProviderGlyph id={id} size={ICON_SIZE.control} />
              <span className="flex-1 text-left">Connect {PROVIDER_LABEL[id]}</span>
              <span className="text-meta text-faint-foreground">Not connected</span>
            </SelectableRow>
          </li>
        ))}
        <li>
          <SelectableRow
            selected={false}
            onClick={() => {
              onClose();
              openProviderUsage({ providerId: null });
            }}
            className="items-center gap-2 px-2 py-1 text-meta text-foreground"
          >
            <CONCEPT_ICONS.settings
              size={ICON_SIZE.row}
              aria-hidden
              className={tintClasses(CONCEPT_TONE.settings).icon}
            />
            <span className="flex-1 text-left">Manage providers</span>
            <ArrowUpRight size={ICON_SIZE.row} aria-hidden className="text-faint-foreground" />
          </SelectableRow>
        </li>
      </ul>
    </>
  );
};
