import { Divider } from '@goodboy/ui';
import { X } from 'lucide-react';

type Props = {
  readonly title: string;
  readonly closeLabel: string;
  readonly onClose: () => void;
};

export const InspectorHeader = ({ title, closeLabel, onClose }: Props) => (
  <>
    <div className="flex shrink-0 items-center justify-between gap-2 px-3 py-2.5">
      <span className="truncate text-xs font-medium text-foreground" title={title}>
        {title}
      </span>
      <button
        type="button"
        onClick={onClose}
        aria-label={closeLabel}
        className="rounded-md p-1 text-muted-foreground/60 transition-colors hover:bg-foreground/5 hover:text-foreground"
      >
        <X size={14} aria-hidden />
      </button>
    </div>
    <Divider />
  </>
);
