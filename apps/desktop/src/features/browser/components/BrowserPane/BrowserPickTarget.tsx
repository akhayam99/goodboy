import { ChevronDown } from '@goodboy/ui/icons';
import { AnchoredPopover, Button, ICON_SIZE, MENU_MAX_WIDTH, useDropdown } from '@goodboy/ui';
import { AppMenuList } from '../../../actions/AppMenuList';
import type { ElementPick } from '../../hooks/useElementPick';

type Props = {
  readonly pick: ElementPick;
};

export const BrowserPickTarget = ({ pick }: Props) => {
  const dropdown = useDropdown({
    width: 'min-w-[200px]',
    maxWidth: MENU_MAX_WIDTH,
    expectedHeight: 200,
    expectedWidth: 240,
  });
  const label = pick.agentName === null ? 'No agent' : `To ${pick.agentName}`;
  if (pick.targets.length < 2) {
    return <span className="truncate text-meta text-muted-foreground">{label}</span>;
  }
  return (
    <AnchoredPopover
      dropdown={dropdown}
      anchorClassName="min-w-0"
      trigger={
        <Button
          variant="ghost"
          size="xs"
          aria-haspopup="menu"
          aria-expanded={dropdown.open}
          onClick={dropdown.toggle}
        >
          {label}
          <ChevronDown size={ICON_SIZE.row} aria-hidden />
        </Button>
      }
    >
      <AppMenuList
        label="Add to the message of"
        onClose={dropdown.close}
        entries={pick.targets.map((target) => ({
          kind: 'item' as const,
          key: target.agentId,
          label: target.name,
          hint: target.agentId === pick.agentId ? 'Chosen' : null,
          onSelect: () => pick.chooseAgent({ agentId: target.agentId }),
        }))}
      />
    </AnchoredPopover>
  );
};
