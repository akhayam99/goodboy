import { ChevronDown } from 'lucide-react';
import type { WorkspaceId } from '@goodboy/types';
import { AnchoredPopover, Eyebrow, FieldRow, cn, useDropdown } from '@goodboy/ui';
import { useAppStore } from '../../../../../store';
import { ICON_SIZE } from '../../../../../shared/components/conceptIcons';
import { ProviderGlyph } from '../../../../../shared/components/RoutingPicker/ProviderGlyph';
import { useProviderPolicy } from '../../../hooks/useProviderPolicy';
import { PROVIDER_LABEL } from '../../../providerLabel';
import { ProviderPolicyList } from '../../ProviderPolicyList';

type Props = {
  readonly workspaceId: WorkspaceId;
};

const PANEL_WIDTH = 500;
const PANEL_HEIGHT = 360;

export const ProvidersInOrder = ({ workspaceId }: Props) => {
  const { summary } = useProviderPolicy({ workspaceId });
  const workspaceName = useAppStore(
    (state) =>
      state.workspaces.find((workspace) => workspace.id === workspaceId)?.name ?? 'this workspace',
  );
  const dropdown = useDropdown({
    align: 'end',
    width: 'w-[500px]',
    expectedWidth: PANEL_WIDTH,
    expectedHeight: PANEL_HEIGHT,
  });
  const firstOn = summary.on[0] ?? null;
  const help =
    firstOn === null
      ? 'No provider is on. Backup only runs when no On provider can work.'
      : `New work starts on ${PROVIDER_LABEL[firstOn]}. Backup only runs when no On provider can work.`;

  return (
    <FieldRow label="Providers, in order" help={help}>
      <AnchoredPopover
        dropdown={dropdown}
        role="dialog"
        ariaLabel="Providers, in order"
        className="flex flex-col gap-1 p-2"
        anchorClassName="min-w-0"
        trigger={
          <button
            type="button"
            aria-haspopup="dialog"
            aria-expanded={dropdown.open}
            onClick={dropdown.toggle}
            className="flex max-w-80 min-w-0 items-center gap-2 rounded-md border border-border-soft px-2 py-1 text-label text-foreground hover:bg-hover"
          >
            <span className="flex shrink-0 items-center gap-0.5">
              {summary.on.slice(0, 3).map((id) => (
                <ProviderGlyph key={id} id={id} size={ICON_SIZE.control} />
              ))}
            </span>
            <span className="min-w-0 truncate">{summary.text}</span>
            <ChevronDown
              size={ICON_SIZE.row}
              aria-hidden
              className={cn('shrink-0 text-faint-foreground', dropdown.open && 'rotate-180')}
            />
          </button>
        }
      >
        <div className="flex flex-col px-1 pt-1">
          <Eyebrow label="Providers, in order" />
          <span className="text-secondary text-faint-foreground">
            For {workspaceName} · saved as you change it
          </span>
        </div>
        <ProviderPolicyList workspaceId={workspaceId} workspaceName={workspaceName} hasReset />
      </AnchoredPopover>
    </FieldRow>
  );
};
