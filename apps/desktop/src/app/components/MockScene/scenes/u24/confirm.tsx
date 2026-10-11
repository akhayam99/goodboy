import { sceneParam } from '../audit/sceneParams';
import { FrameFor } from './confirm/FrameFor';
import { VARIANTS, isVariant } from './confirm/variants';

const ConfirmPopoverScene = () => {
  const requested = sceneParam({ key: 'v' });
  const variants = isVariant(requested) ? [requested] : VARIANTS;
  return (
    <main
      data-slot="confirm-scene"
      className="mx-auto flex min-h-screen w-full max-w-xl flex-col gap-4 bg-background p-6"
    >
      {variants.map((variant) => (
        <FrameFor key={variant} variant={variant} />
      ))}
    </main>
  );
};

export const U24_CONFIRM_SCENES = {
  confirmpopover: ConfirmPopoverScene,
};
