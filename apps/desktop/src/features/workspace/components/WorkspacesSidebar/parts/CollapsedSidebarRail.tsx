import { PanelLeftOpen, Plus } from 'lucide-react';
import { useCurrentWorkspace } from '../../../../../store';
import { workspaceAccent } from '../../../color';
import { FOOTER_ICON_BTN } from '../lib';

const initialOf = (name: string): string => name.trim().charAt(0).toUpperCase() || '?';

type Props = {
  onExpand: () => void;
};

export const CollapsedSidebarRail = ({ onExpand }: Props) => {
  const currentWorkspace = useCurrentWorkspace();
  const accent = currentWorkspace ? workspaceAccent(currentWorkspace.id) : null;

  return (
    <div className="flex h-full w-full flex-col items-center gap-2 py-3">
      {currentWorkspace && accent ? (
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent('goodboy:open-workspace-switcher'))}
          title={`switch workspace (${currentWorkspace.name})`}
          aria-label="switch or open a workspace"
          className="flex size-7 shrink-0 items-center justify-center rounded-md text-xs font-bold text-primary-foreground shadow-sm motion-safe:transition-transform motion-safe:hover:scale-105"
          style={{ backgroundColor: accent }}
        >
          {initialOf(currentWorkspace.name)}
        </button>
      ) : null}
      <button
        type="button"
        onClick={() => window.dispatchEvent(new CustomEvent('goodboy:new-session'))}
        title="new session"
        aria-label="create new session"
        className={FOOTER_ICON_BTN}
      >
        <Plus size={16} aria-hidden />
      </button>
      <div className="flex-1" />
      <button
        type="button"
        onClick={onExpand}
        title="expand sidebar (⌘B)"
        aria-label="expand sidebar"
        className={FOOTER_ICON_BTN}
      >
        <PanelLeftOpen size={16} aria-hidden />
      </button>
    </div>
  );
};
