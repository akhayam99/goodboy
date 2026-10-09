import { DogMascot } from '@goodboy/ui';

export const BootBrand = () => (
  <div className="flex flex-col items-center gap-4">
    <DogMascot size={64} className="text-primary" />
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-title">Goodboy</span>
      <span className="text-label tracking-tight text-faint-foreground">
        workspace orchestrator for coding agents
      </span>
    </div>
  </div>
);
