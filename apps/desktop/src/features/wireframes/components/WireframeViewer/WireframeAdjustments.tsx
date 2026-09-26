import { useState } from 'react';
import type { WireframeAdjustment, WireframeAdjustmentChange } from '@goodboy/core';
import { Collapsible } from '@goodboy/ui';

type Props = {
  readonly adjustments: ReadonlyArray<WireframeAdjustment>;
};

const CHANGES = [
  'moved',
  'clipped',
  'dropped',
] as const satisfies ReadonlyArray<WireframeAdjustmentChange>;

const SUMMARY_CLAUSE: Readonly<Record<WireframeAdjustmentChange, string>> = {
  moved: 'some values were moved',
  clipped: 'some text was shortened',
  dropped: 'some properties were dropped',
};

const HIDDEN_NOUN: Readonly<Record<WireframeAdjustmentChange, readonly [string, string]>> = {
  moved: ['value moved', 'values moved'],
  clipped: ['field shortened', 'fields shortened'],
  dropped: ['key dropped', 'keys dropped'],
};

const sentence = ({ parts }: { readonly parts: ReadonlyArray<string> }): string => {
  if (parts.length <= 1) {
    return parts.join('');
  }
  const head = parts.slice(0, -1);
  return `${head.join(', ')} and ${parts[parts.length - 1]}`;
};

const countOf = ({
  adjustments,
  change,
}: {
  readonly adjustments: ReadonlyArray<WireframeAdjustment>;
  readonly change: WireframeAdjustmentChange;
}): number =>
  adjustments.reduce((total, entry) => {
    if (entry.change === 'hidden') {
      return total + entry[change];
    }
    return entry.change === change ? total + 1 : total;
  }, 0);

const summaryOf = ({
  adjustments,
}: {
  readonly adjustments: ReadonlyArray<WireframeAdjustment>;
}): string => {
  const parts = CHANGES.filter((change) => countOf({ adjustments, change }) > 0).map(
    (change) => SUMMARY_CLAUSE[change],
  );
  return `${sentence({ parts })} to draw this wireframe`;
};

const hiddenLabel = ({
  hidden,
}: {
  readonly hidden: Readonly<Record<WireframeAdjustmentChange, number>>;
}): string => {
  const parts = CHANGES.filter((change) => hidden[change] > 0).map((change) => {
    const total = hidden[change];
    const [one, many] = HIDDEN_NOUN[change];
    return `${total} more ${total === 1 ? one : many}`;
  });
  return `and ${sentence({ parts })}`;
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
          <span className="text-secondary font-normal text-muted-foreground">
            {summaryOf({ adjustments })}
          </span>
        }
      >
        <ul className="flex flex-col gap-1">
          {adjustments.map((adjustment) =>
            adjustment.change === 'hidden' ? (
              <li key="hidden" className="text-secondary text-muted-foreground">
                {hiddenLabel({ hidden: adjustment })}
              </li>
            ) : (
              <li
                key={`${adjustment.path}-${adjustment.message}`}
                className="text-secondary text-muted-foreground"
              >
                <span className="font-mono text-foreground">{adjustment.path}</span>
                {': '}
                {adjustment.message}
                {adjustment.count > 1 ? ` (${adjustment.count} places)` : null}
              </li>
            ),
          )}
        </ul>
      </Collapsible>
    </div>
  );
};
