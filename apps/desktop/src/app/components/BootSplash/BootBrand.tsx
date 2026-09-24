import { DogMascot } from '../../../shared/components/DogMascot';

export const BootBrand = () => (
  <div className="flex flex-col items-center gap-5">
    <DogMascot size={64} className="text-primary" />
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-lg font-bold tracking-tight">Goodboy</span>
      <span className="text-xs tracking-tight text-faint-foreground">
        workspace orchestrator for coding agents
      </span>
    </div>
  </div>
);
