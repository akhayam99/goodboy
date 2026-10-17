import { lazy } from 'react';
import { StudioFrame } from '../../../StudioFrame';
import { STUDIO_META } from '../../../StudioFrame/studioMeta';
import type { StudioKind } from '../../../../../store';

const Pending = lazy(() => new Promise<never>(() => undefined));

const noop = () => undefined;

type Props = {
  readonly kind: StudioKind;
};

export const R4LayoutLoadingScene = ({ kind }: Props) => (
  <div className="flex h-screen w-full bg-chrome p-2">
    <p className="sr-only">{`${STUDIO_META[kind].title} while its page loads`}</p>
    <StudioFrame kind={kind} placement="content" onClose={noop}>
      <Pending />
    </StudioFrame>
  </div>
);
