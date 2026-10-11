import { useEffect, useState } from 'react';
import { Terminal } from 'lucide-react';
import type { WorkspaceId } from '@goodboy/types';
import { Button } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import { selectTerminalWorkspaceFolder } from '../../../../store/slices/terminal/selectors';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { homeFolder } from '../../../../shared/lib/homeFolder';
import { usePickFolder } from '../../../../shared/hooks/usePickFolder';

type Props = {
  readonly workspaceId: WorkspaceId;
};

type SaveParams = {
  readonly next: string | null;
};

export const WorkspaceTerminalFolderRow = ({ workspaceId }: Props) => {
  const projects = useAppStore((state) => state.projects);
  const overrides = useAppStore((state) => state.terminalFolderOverrides);
  const loadTerminalWorkspaceFolder = useAppStore((state) => state.loadTerminalWorkspaceFolder);
  const setTerminalWorkspaceFolder = useAppStore((state) => state.setTerminalWorkspaceFolder);
  const reportError = useAppStore((state) => state.reportError);
  const pickFolder = usePickFolder();
  const [home, setHome] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const override = overrides[workspaceId] ?? null;
  const isOverridden = override !== null && override.trim() !== '';
  const folder = selectTerminalWorkspaceFolder({
    state: { projects, terminalFolderOverrides: overrides },
    workspaceId,
    home,
  });

  useEffect(() => {
    void loadTerminalWorkspaceFolder({ workspaceId });
  }, [loadTerminalWorkspaceFolder, workspaceId]);

  useEffect(() => {
    let isCurrent = true;
    void homeFolder().then((found) => {
      if (isCurrent) {
        setHome(found);
      }
    });
    return () => {
      isCurrent = false;
    };
  }, []);

  const save = async ({ next }: SaveParams): Promise<void> => {
    setIsBusy(true);
    try {
      await setTerminalWorkspaceFolder({ workspaceId, folder: next });
    } catch (error) {
      void reportError({ title: "Couldn't save the terminal folder", error });
    } finally {
      setIsBusy(false);
    }
  };

  const change = async (): Promise<void> => {
    const picked = await pickFolder();
    if (picked === null) {
      return;
    }
    await save({ next: picked });
  };

  return (
    <div
      role="group"
      aria-label="Terminal folder"
      className="flex h-8 min-w-0 items-center gap-2 px-2"
    >
      <Terminal size={ICON_SIZE.row} aria-hidden className="shrink-0 text-muted-foreground" />
      <span className="shrink-0 text-label text-muted-foreground">Terminal folder</span>
      <span className="min-w-0 flex-1 truncate text-code text-meta text-foreground">
        {folder ?? 'No folder yet'}
      </span>
      {isOverridden ? (
        <Button
          variant="ghost"
          size="sm"
          disabled={isBusy}
          onClick={() => void save({ next: null })}
        >
          Use the default
        </Button>
      ) : null}
      <Button variant="ghost" size="sm" disabled={isBusy} onClick={() => void change()}>
        Change
      </Button>
    </div>
  );
};
