import { ChevronDown, Plus } from 'lucide-react';
import { AnchoredPopover, Button, PopoverBody, Tooltip, useDropdown } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { useAppStore } from '../../../../store';
import type { PickerCluster } from '../../terminalPickerClusters';
import type { TerminalTarget } from '../../terminalTargets';
import { PickerClusterView } from './PickerClusterView';

type Props = {
  readonly clusters: ReadonlyArray<PickerCluster>;
  readonly onNew: () => void;
  readonly onOpenAt: (target: TerminalTarget) => void;
};

const PICKER_WIDTH_CLASS = 'w-[32.5rem]';
const PICKER_EXPECTED_WIDTH = 520;
const PICKER_EXPECTED_HEIGHT = 420;
const PICKER_MAX_WIDTH = 520;

export const NewTerminalMenu = ({ clusters, onNew, onOpenAt }: Props) => {
  const switchStudio = useAppStore((state) => state.switchStudio);
  const dropdown = useDropdown({
    align: 'after',
    width: PICKER_WIDTH_CLASS,
    expectedWidth: PICKER_EXPECTED_WIDTH,
    expectedHeight: PICKER_EXPECTED_HEIGHT,
    maxWidth: PICKER_MAX_WIDTH,
  });
  const hasChoices = clusters.reduce((total, cluster) => total + cluster.rows.length, 0) > 1;

  const pick = (target: TerminalTarget): void => {
    dropdown.close();
    onOpenAt(target);
  };

  const openProject = (): void => {
    dropdown.close();
    switchStudio({
      studio: { kind: 'settings', focus: { scope: 'workspace', section: 'projects' } },
    });
  };

  return (
    <div className="flex min-w-0 items-stretch">
      <Button
        variant="secondary"
        className="min-w-0 flex-1 justify-start rounded-r-none"
        onClick={onNew}
      >
        <Plus size={ICON_SIZE.control} aria-hidden />
        New terminal
      </Button>
      {hasChoices ? (
        <AnchoredPopover
          dropdown={dropdown}
          anchorClassName="flex shrink-0"
          role="menu"
          ariaLabel="New terminal in"
          className="gap-0 p-0"
          trigger={
            <Tooltip content="New terminal in" anchorClassName="flex h-full">
              <Button
                variant="secondary"
                aria-label="New terminal in"
                aria-haspopup="menu"
                aria-expanded={dropdown.open}
                className="h-full rounded-l-none border-l-0 px-2"
                onClick={dropdown.toggle}
              >
                <ChevronDown size={ICON_SIZE.control} aria-hidden />
              </Button>
            </Tooltip>
          }
        >
          <PopoverBody className="max-h-full">
            <div className="flex flex-col gap-3 p-2">
              {clusters.map((cluster) => (
                <PickerClusterView
                  key={cluster.key}
                  cluster={cluster}
                  onPick={pick}
                  onOpenProject={openProject}
                />
              ))}
            </div>
          </PopoverBody>
        </AnchoredPopover>
      ) : null}
    </div>
  );
};
