import { useLayoutEffect } from 'react';
import type { StudioFrameHandle } from './studioFrameContext';
import type { StudioShellProps } from './types';

type Props = StudioShellProps & {
  readonly frame: StudioFrameHandle;
};

export const FramedStudio = ({
  frame,
  icon,
  tone,
  glyph,
  title,
  subtitle,
  closeLabel,
  headerAccessory,
  isEscapeEnabled = true,
  children,
}: Props) => {
  const { setChrome, requestClose } = frame;

  useLayoutEffect(() => {
    setChrome({
      ...(icon !== undefined && { icon }),
      ...(tone !== undefined && { tone }),
      ...(glyph !== undefined && { glyph }),
      title,
      ...(subtitle !== undefined && { subtitle }),
      closeLabel,
      ...(headerAccessory !== undefined && { accessory: headerAccessory }),
      isEscapeEnabled,
    });
  }, [setChrome, icon, tone, glyph, title, subtitle, closeLabel, headerAccessory, isEscapeEnabled]);

  useLayoutEffect(() => () => setChrome(null), [setChrome]);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 motion-safe:animate-studio-body-in">
      {children(requestClose)}
    </div>
  );
};
