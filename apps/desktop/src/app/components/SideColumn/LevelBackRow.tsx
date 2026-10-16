import { ChevronLeft } from 'lucide-react';
import { SelectableRow } from '@goodboy/ui';
import { ICON_SIZE } from '../../../shared/components/conceptIcons';

type Props = {
  readonly label: string;
  readonly spokenLabel?: string;
  readonly onBack: () => void;
};

export const LevelBackRow = ({ label, spokenLabel = label, onBack }: Props) => (
  <div data-level-back="">
    <SelectableRow
      selected={false}
      ariaLabel={`Back to ${spokenLabel}`}
      title={`Back to ${label}`}
      onClick={onBack}
      className="h-7 items-center gap-1 px-2 text-label"
    >
      <ChevronLeft size={ICON_SIZE.row} aria-hidden className="shrink-0" />
      <span className="truncate">{label}</span>
    </SelectableRow>
  </div>
);
