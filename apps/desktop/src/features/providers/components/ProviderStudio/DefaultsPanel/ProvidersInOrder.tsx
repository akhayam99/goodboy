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
import type { PolicySummary } from '../../../policy/policySummary';
import { PROVIDER_LABEL } from '../../../providerLabel';
import { ProviderPolicyList } from '../../ProviderPolicyList';
import { SettingRow } from '../../../../settings/settingRow';
import { SpreadByHeadroomRow } from './SpreadByHeadroomRow';

type Props = {
  readonly workspaceId: WorkspaceId;
};

const PANEL_HEIGHT = 430;

const LIST_FORMAT = new Intl.ListFormat('en', { type: 'conjunction' });

type HelpParams = {
  readonly summary: PolicySummary;
};

const orderHelpOf = ({ summary }: HelpParams): string => {
  const [first, ...otherOn] = summary.on;
  if (first === undefined) {
    return 'No provider is on. Turn one on to start new work.';
  }
  const name = PROVIDER_LABEL[first];
  const rest = [...otherOn, ...summary.backup].map((id) => PROVIDER_LABEL[id]);
  if (rest.length === 0) {
    return `Every new agent starts on ${name}. No other provider is on to take over.`;
  }
  const verb = rest.length === 1 ? 'takes' : 'take';
  return `Every new agent starts on ${name} while ${name} can work. ${LIST_FORMAT.format(rest)} ${verb} over only when it cannot.`;
};

export const ProvidersInOrder = ({ workspaceId }: Props) => {
  const { summary } = useProviderPolicy({ workspaceId });
  const dropdown = useDropdown({
    width: POPOVER_WIDTH_CLASS.studio,
    expectedWidth: POPOVER_WIDTH_PX.studio,
    expectedHeight: PANEL_HEIGHT,
  });
  const help = orderHelpOf({ summary });

  return (
    <SettingRow label="When a provider is out" rowKey="provider-order" help={help}>
      <AnchoredPopover
        dropdown={dropdown}
        role="dialog"
        ariaLabel="When a provider is out"
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
          <Eyebrow label="When a provider is out" />
          <span className="text-meta text-faint-foreground">This workspace</span>
        </div>
        <ProviderPolicyList workspaceId={workspaceId} hasReset />
        <SpreadByHeadroomRow workspaceId={workspaceId} />
      </AnchoredPopover>
    </SettingRow>
  );
};
