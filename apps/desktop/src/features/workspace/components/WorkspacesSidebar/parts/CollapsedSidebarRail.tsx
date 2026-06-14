import { PanelLeftOpen } from 'lucide-react';
import { DogMascot } from '../../../../../shared/components/DogMascot';
import { FOOTER_ICON_BTN } from '../lib';

type Props = {
  onExpand: () => void;
};

export const CollapsedSidebarRail = ({ onExpand }: Props) => {
  return (
    <div className="flex h-full w-full flex-col items-center justify-between py-3">
      <DogMascot size={18} className="shrink-0 text-foreground" />
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
