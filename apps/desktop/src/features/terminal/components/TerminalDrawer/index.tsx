import { useEffect } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { Button, Chip, DrawerFrame } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import type { TerminalTabId } from '../../../../shared/types/terminal';
import { useAppStore } from '../../../../store';
import { folderName, terminalOwnerKey } from '../../../../store/slices/terminal/terminalOwner';
import { openTerminalOnPage } from '../../openTerminalOnPage';
import { TerminalPane } from '../TerminalStudio/TerminalPane';

type Props = {
  readonly sessionId: SessionId;
  readonly terminalId: TerminalTabId;
  readonly onClose: () => void;
};

export const TerminalDrawer = ({ sessionId, terminalId, onClose }: Props) => {
  const tab = useAppStore(
    (s) =>
      (s.terminalTabs[terminalOwnerKey({ owner: { kind: 'session', sessionId } })] ?? []).find(
        (candidate) => candidate.id === terminalId,
      ) ?? null,
  );

  useEffect(() => {
    if (tab === null) {
      onClose();
    }
  }, [tab, onClose]);

  if (tab === null) {
    return null;
  }
  const worktree = folderName({ path: tab.cwd });
  return (
    <DrawerFrame
      title={tab.title}
      icon={CONCEPT_ICONS.terminal}
      iconClassName="text-faint-foreground"
      count={
        worktree === null ? null : (
          <Chip
            tone="neutral"
            label={worktree}
            icon={<CONCEPT_ICONS.worktree size={ICON_SIZE.row} aria-hidden />}
          />
        )
      }
      action={
        <Button
          variant="ghost"
          size="sm"
          onClick={() => openTerminalOnPage({ terminalId, sessionId })}
        >
          Open on Terminal page
          <ArrowUpRight size={ICON_SIZE.row} aria-hidden />
        </Button>
      }
      onClose={onClose}
      scroll="self"
    >
      <div className="flex h-full min-h-0 flex-1 flex-col p-2">
        <TerminalPane key={tab.id} tab={tab} isActive />
      </div>
    </DrawerFrame>
  );
};
