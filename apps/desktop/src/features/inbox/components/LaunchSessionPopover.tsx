import { useEffect, useState } from 'react';
import { Rocket } from 'lucide-react';
import { AnchoredPopover, Button, Kbd, useDropdown } from '@goodboy/ui';
import type { WorkspaceId } from '@goodboy/types';
import { ICON_SIZE } from '../../../shared/components/conceptIcons';
import { shortcutGlyphs } from '../../../shared/keyboard/registry';
import { NAMES } from '../../../shared/names';
import { LaunchSessionPanel } from '../../integrations/components/LaunchSessionPanel';
import type { LaunchMount } from '../launchMountFor';
import type { LaunchSpec } from '../launchSpecFor';

const startASessionLabel = `${NAMES.start} a session`;

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly spec: LaunchSpec;
  readonly label: string;
  readonly openRequest: number;
  readonly onLaunched: () => void;
  readonly mount?: LaunchMount | null;
};

export const LaunchSessionPopover = ({
  workspaceId,
  spec,
  label,
  openRequest,
  onLaunched,
  mount = null,
}: Props) => {
  const dropdown = useDropdown({ align: 'start', width: 'w-96', expectedHeight: 320 });
  const [focusRequest, setFocusRequest] = useState(0);
  const { open: isOpen, toggle } = dropdown;

  useEffect(() => {
    if (openRequest === 0) {
      return;
    }
    if (!isOpen) {
      toggle();
    }
    setFocusRequest((current) => current + 1);
  }, [openRequest]);

  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="dialog"
      ariaLabel={startASessionLabel}
      className="p-2"
      trigger={
        <Button
          size="sm"
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          onClick={() => {
            toggle();
            setFocusRequest((current) => current + 1);
          }}
        >
          <Rocket size={ICON_SIZE.row} aria-hidden />
          {label}
          <Kbd look="inline" isOnTone aria-hidden>
            {shortcutGlyphs('list.open')}
          </Kbd>
        </Button>
      }
    >
      <LaunchSessionPanel
        workspaceId={workspaceId}
        linkedSessionId={null}
        goalSeed={spec.goalSeed}
        externalTask={spec.externalTask}
        startLabel={label}
        briefSource={spec.briefSource}
        onClose={onLaunched}
        focusRequest={focusRequest}
        mount={mount}
      />
    </AnchoredPopover>
  );
};
