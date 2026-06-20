import { Divider } from '@goodboy/ui';
import { DogMascot } from '../../../shared/components/DogMascot';
import { UpdateIndicator } from '../../../features/updater/components/UpdateIndicator';

export const AppTopBar = () => (
  <>
    <div
      data-tauri-drag-region
      className="flex h-9 shrink-0 items-center justify-between bg-background px-3"
    >
      <div className="flex items-center gap-1.5">
        <DogMascot size={15} className="shrink-0 text-foreground" />
        <span className="text-xs font-semibold tracking-tight text-foreground">Goodboy</span>
        <UpdateIndicator variant="pip" />
      </div>
      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary ring-1 ring-primary/15">
        Beta
      </span>
    </div>
    <Divider />
  </>
);
