import type { ReactNode } from 'react';

type Props = {
  readonly label: string;
  readonly testId: string;
  readonly onOpen: (() => void) | null;
  readonly children: ReactNode;
};

export const CommentMarkerChipLink = ({ label, testId, onOpen, children }: Props) => {
  if (onOpen === null) {
    return <div className="w-full">{children}</div>;
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={label}
      data-testid={testId}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') {
          return;
        }
        event.preventDefault();
        onOpen();
      }}
      className="w-full cursor-pointer text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
    >
      {children}
    </div>
  );
};
