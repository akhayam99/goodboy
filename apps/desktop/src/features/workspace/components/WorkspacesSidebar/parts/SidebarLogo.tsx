import { DogMascot } from '../../../../../shared/components/DogMascot';
import { UpdateIndicator } from '../../../../updater/components/UpdateIndicator';

export const SidebarLogo = () => {
  return (
    <span className="flex items-center gap-1.5">
      <DogMascot size={16} className="shrink-0 text-foreground" />
      <span className="text-xs font-semibold tracking-tight text-foreground">Goodboy</span>
      <UpdateIndicator variant="pip" />
    </span>
  );
};
