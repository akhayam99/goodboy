import { ChevronRight } from 'lucide-react';
import { changelogScreenLabel } from '../../changelogScreens';
import type { ChangelogScreen } from '../../changelogScreens';

type Props = {
  readonly screen: ChangelogScreen | null;
  readonly onOpenScreen?: (params: { readonly screen: ChangelogScreen }) => void;
};

export const OpenScreenLink = ({ screen, onOpenScreen }: Props) => {
  if (screen === null || onOpenScreen === undefined) {
    return null;
  }
  return (
    <button
      type="button"
      onClick={() => onOpenScreen({ screen })}
      className="flex items-center gap-0.5 text-xs text-primary hover:underline"
    >
      Open {changelogScreenLabel({ screen })}
      <ChevronRight size={12} aria-hidden />
    </button>
  );
};
