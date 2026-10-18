import { Button } from '@goodboy/ui';
import { BrandTile } from '../../../shared/components/BrandTile';
import { Stepper } from './Stepper';
import type { WizardMode, WizardStepId } from './wizardSteps';

const HEADER_TILE_PX = 22;

type Props = {
  readonly mode: WizardMode;
  readonly step: WizardStepId;
  readonly isLocked: boolean;
  readonly onLeave: () => void;
};

export const WizardHeader = ({ mode, step, isLocked, onLeave }: Props) => {
  const isCover = step === 'welcome';
  return (
    <header className="grid h-13 grid-cols-[1fr_auto_1fr] items-center gap-4 px-5">
      <div className="flex min-w-0 items-center gap-2">
        {isCover ? null : (
          <>
            <BrandTile size={HEADER_TILE_PX} />
            <span className="text-heading text-foreground">Goodboy</span>
          </>
        )}
      </div>
      <div className="flex min-w-0 justify-center">
        {mode === 'single' ? null : <Stepper current={step} />}
      </div>
      <div className="flex justify-end">
        <Button variant="quiet" size="sm" onClick={onLeave} disabled={isLocked}>
          {mode === 'single' ? 'Close' : 'Set up later'}
        </Button>
      </div>
    </header>
  );
};
