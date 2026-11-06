import { createPortal } from 'react-dom';
import type { FloatingCoords } from '../placeFloating';
import { Kbd } from './Kbd';

type Props = {
  readonly tipRef: React.Ref<HTMLSpanElement>;
  readonly tipId: string;
  readonly coords: FloatingCoords | null;
  readonly content: React.ReactNode;
  readonly keys: string;
  readonly target: Element;
  readonly className: string;
};

export const TooltipBubble = ({ tipRef, tipId, coords, content, keys, target, className }: Props) =>
  createPortal(
    <span
      ref={tipRef}
      id={tipId}
      role="tooltip"
      style={{
        position: 'fixed',
        top: coords?.top ?? -9999,
        left: coords?.left ?? -9999,
        visibility: coords === null ? 'hidden' : 'visible',
      }}
      className={className}
    >
      {keys === '' ? (
        content
      ) : (
        <span className="inline-flex items-baseline gap-2">
          <span>{content}</span>
          <Kbd>{keys}</Kbd>
        </span>
      )}
    </span>,
    target,
  );
