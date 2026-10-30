import { useEffect, useRef } from 'react';
import { GitBranch } from 'lucide-react';
import { ICON_SIZE, InteractiveRow, TruncatedText } from '@goodboy/ui';

const SHOW_AFTER_MS = 450;

const CUT_TITLE =
  'Reconcile every duplicated credit in the Harborline ledger export before the Northwind close';

export const CutTitleRow = () => {
  const titleRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const title = titleRef.current;
    if (title === null) {
      return;
    }
    const timer = setTimeout(
      () => title.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })),
      SHOW_AFTER_MS,
    );
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="w-72">
      <InteractiveRow
        label="Open the Harborline reconcile agent"
        isSelected={false}
        onOpen={() => undefined}
        frameClassName="bg-elevated"
        radius="lg"
        className="flex min-w-0 items-center gap-2 p-3 text-meta"
      >
        <GitBranch size={ICON_SIZE.row} aria-hidden className="shrink-0" />
        <TruncatedText ref={titleRef} isFocusable className="min-w-0 text-foreground">
          {CUT_TITLE}
        </TruncatedText>
      </InteractiveRow>
    </div>
  );
};
