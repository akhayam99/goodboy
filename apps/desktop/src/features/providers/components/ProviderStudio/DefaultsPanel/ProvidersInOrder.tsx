import { ChevronDown } from '@goodboy/ui/icons';
import type { WorkspaceId } from '@goodboy/types';
import {
  AnchoredPopover,
  cn,
  Eyebrow,
  ICON_SIZE,
  POPOVER_WIDTH_CLASS,
  POPOVER_WIDTH_PX,
  useDropdown,
} from '@goodboy/ui';

import { ProviderGlyph } from '../../../../../shared/components/RoutingPicker/ProviderGlyph';
import { useProviderPolicy } from '../../../hooks/useProviderPolicy';
import { useRoutingSnapshot } from '../../../hooks/useRoutingSnapshot';
import type { PolicySummary } from '../../../policy/policySummary';
import { PROVIDER_LABEL } from '../../../providerLabel';
import { ProviderPolicyList } from '../../ProviderPolicyList';
import { SettingRow } from '../../../../settings/settingRow';
import { GuardsRow } from './GuardsRow';
import { LastHoursRow } from './LastHoursRow';
import { ProviderRuleRow } from './ProviderRuleRow';
import { RoomNowRow } from './RoomNowRow';

type Props = {
  readonly workspaceId: WorkspaceId;
};

const LABEL = 'Provider order';

const PANEL_HEIGHT = 430;

type HelpParams = {
  readonly summary: PolicySummary;
};

const orderHelpOf = ({ summary }: HelpParams): string => {
  const [first, ...otherOn] = summary.on;
  if (first === undefined) {
    return 'No provider is on. Turn one on to start new work.';
  }
  if (otherOn.length === 0 && summary.backup.length === 0) {
    return `Only ${PROVIDER_LABEL[first]} is on, so every new agent starts there.`;
  }
  const lead = 'The Lead reads this order when it picks a provider for a new agent.';
  return summary.backup.length === 0
    ? lead
    : `${lead} Backup runs only when no On provider can work.`;
};

export const ProvidersInOrder = ({ workspaceId }: Props) => {
  const { summary } = useProviderPolicy({ workspaceId });
  const snapshot = useRoutingSnapshot({ workspaceId });
  const dropdown = useDropdown({
    width: POPOVER_WIDTH_CLASS.studio,
    expectedWidth: POPOVER_WIDTH_PX.studio,
    expectedHeight: PANEL_HEIGHT,
  });
  const help = orderHelpOf({ summary });
  const inOrder = [...summary.on, ...summary.backup];

  return (
    <>
      <SettingRow label={LABEL} rowKey="provider-order" help={help}>
        <AnchoredPopover
          dropdown={dropdown}
          role="dialog"
          ariaLabel={LABEL}
          className="flex flex-col gap-1 p-2"
          anchorClassName="min-w-0"
          trigger={
            <button
              type="button"
              aria-haspopup="dialog"
              aria-expanded={dropdown.open}
              onClick={dropdown.toggle}
              className="flex max-w-80 min-w-0 items-center gap-2 rounded-md border border-border-soft px-2 py-1 text-meta text-foreground hover:bg-hover"
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
            <Eyebrow label={LABEL} />
            <span className="text-meta text-faint-foreground">This workspace</span>
          </div>
          <ProviderPolicyList workspaceId={workspaceId} hasReset />
        </AnchoredPopover>
      </SettingRow>
      <ProviderRuleRow workspaceId={workspaceId} />
      {snapshot === null ? null : <RoomNowRow providers={inOrder} inputs={snapshot.inputs} />}
      <GuardsRow providers={inOrder} />
      {snapshot === null ? null : (
        <LastHoursRow providers={inOrder} lastHours={snapshot.lastHours} />
      )}
    </>
  );
};
