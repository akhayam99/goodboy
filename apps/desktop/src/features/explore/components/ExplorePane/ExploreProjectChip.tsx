import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { AnchoredPopover, Chip, useDropdown } from '@goodboy/ui';
import type { CrumbMenuGroup } from '@goodboy/ui';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import type { ExploreTarget } from '../../selectExploreMount';
import { ExploreBranchName } from './ExploreBranchName';
import { ExploreProjectMenu } from './ExploreProjectMenu';

const MIN_MENU_ROWS = 2;
const CHIP_CLASS = 'min-w-0 max-w-full shrink';

type Props = {
  readonly target: ExploreTarget;
  readonly groups: ReadonlyArray<CrumbMenuGroup>;
  readonly rowCount: number;
};

type LabelParams = {
  readonly target: ExploreTarget;
};

type ChipLabel = {
  readonly node: ReactNode;
  readonly text: string;
};

const labelOf = ({ target }: LabelParams): ChipLabel | null => {
  if (target.kind === 'none') {
    return null;
  }
  if (target.kind === 'scratch') {
    return {
      node: <span className="truncate">Session scratch folder</span>,
      text: 'Session scratch folder',
    };
  }
  if (target.kind === 'root') {
    const text = `${target.projectName}, project folder`;
    return { node: <span className="truncate">{text}</span>, text };
  }
  if (target.branch === '') {
    return {
      node: <span className="truncate">{target.projectName}</span>,
      text: target.projectName,
    };
  }
  return {
    node: (
      <span className="flex min-w-0 items-center gap-1">
        <span className="truncate">{target.projectName}</span>
        <span aria-hidden className="text-faint-foreground">
          ·
        </span>
        <ExploreBranchName branch={target.branch} />
      </span>
    ),
    text: `${target.projectName}, ${target.branch}`,
  };
};

export const ExploreProjectChip = ({ target, groups, rowCount }: Props) => {
  const dropdown = useDropdown({
    align: 'start',
    width: 'w-80 max-w-[calc(100vw-2rem)]',
    expectedHeight: 260,
    expectedWidth: 320,
  });
  const label = labelOf({ target });
  if (label === null) {
    return null;
  }
  const icon = <CONCEPT_ICONS.projectRepo size={ICON_SIZE.row} aria-hidden className="shrink-0" />;
  const canSwitch = rowCount >= MIN_MENU_ROWS;

  if (!canSwitch) {
    return (
      <Chip
        tone="neutral"
        shape="badge"
        size="control"
        className={CHIP_CLASS}
        icon={icon}
        label={label.node}
        testId="explore-project"
      />
    );
  }

  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="menu"
      ariaLabel="Projects"
      anchorClassName="flex min-w-0 max-w-full"
      trigger={
        <Chip
          as="button"
          tone="neutral"
          shape="badge"
          size="control"
          className={CHIP_CLASS}
          icon={icon}
          label={label.node}
          trailing={
            <ChevronDown
              size={ICON_SIZE.row}
              aria-hidden
              data-slot="switcher-chevron"
              className="shrink-0"
            />
          }
          ariaLabel={`Project ${label.text}`}
          testId="explore-project"
          hasPopup="menu"
          expanded={dropdown.open}
          onClick={dropdown.toggle}
        />
      }
    >
      <ExploreProjectMenu
        groups={groups}
        onChoose={(row) => {
          dropdown.close();
          row.onSelect();
        }}
      />
    </AnchoredPopover>
  );
};
