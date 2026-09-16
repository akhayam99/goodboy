import { useState } from 'react';
import type { WireframeAdjustment } from '@goodboy/core';
import { Collapsible } from '@goodboy/ui';

type Props = {
  readonly adjustments: ReadonlyArray<WireframeAdjustment>;
};

export const WireframeAdjustments = ({ adjustments }: Props) => {
  const [isOpen, setIsOpen] = useState(false);
  if (adjustments.length === 0) {
    return null;
  }
  return (
    <div
      data-testid="wireframe-adjustments"
      className="flex min-w-0 flex-col border-l-2 border-border-soft pl-2"
    >
      <Collapsible
        open={isOpen}
        onOpenChange={setIsOpen}
        trigger={
          <span className="text-2xs font-normal text-muted-foreground">
            some presentation values were outside the schema, so they were adjusted to draw this
            wireframe
          </span>
        }
      >
        <ul className="flex flex-col gap-1">
          {adjustments.map((adjustment) => (
            <li
              key={`${adjustment.path}-${adjustment.message}`}
              className="text-2xs text-muted-foreground"
            >
              {adjustment.path.length === 0 ? null : (
                <>
                  <span className="font-mono text-foreground/80">{adjustment.path}</span>
                  {': '}
                </>
              )}
              {adjustment.message}
              {adjustment.count > 1 ? ` (${adjustment.count} places)` : null}
            </li>
          ))}
        </ul>
      </Collapsible>
    </div>
  );
};
