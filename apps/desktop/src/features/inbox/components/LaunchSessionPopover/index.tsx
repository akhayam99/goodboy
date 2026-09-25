import { useEffect, useState } from 'react';
import { Rocket } from 'lucide-react';
import { AnchoredPopover, Button, KbdPill, useDropdown } from '@goodboy/ui';
import type { WorkspaceId } from '@goodboy/types';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { LaunchSessionPanel } from '../../../integrations/components/LaunchSessionPanel';
import type { LaunchSpec } from '../../launchSpecFor';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly spec: LaunchSpec;
  readonly openRequest: number;
  readonly onLaunched: () => void;
};

export const LaunchSessionPopover = ({ workspaceId, spec, openRequest, onLaunched }: Props) => {
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
      ariaLabel="Launch a session"
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
          Launch session
          <KbdPill>↵</KbdPill>
        </Button>
      }
    >
      <LaunchSessionPanel
        workspaceId={workspaceId}
        linkedSessionId={null}
        goalSeed={spec.goalSeed}
        externalTask={spec.externalTask}
        briefSource={spec.briefSource}
        onClose={onLaunched}
        focusRequest={focusRequest}
      />
    </AnchoredPopover>
  );
};
