import { useEffect, useState } from 'react';
import { BranchPage } from '../../../../../features/branch/components/BranchPage';
import { SESSION } from '../resolveSeed';
import { PR_PAGE_WORKTREE, applyPrPageSeed, type PrPageVariant } from './prPageSeed';

const NARROW_PANE_PX = 860;
const OPEN_DELAY_MS = 500;

type Props = {
  readonly variant: PrPageVariant;
};

const press = ({ selector }: { readonly selector: string }): void => {
  document.querySelector<HTMLElement>(selector)?.click();
};

const openEditors = (): void => {
  press({ selector: 'button[title^="Edit title"]' });
  const edit = [
    ...document.querySelectorAll<HTMLElement>('section[aria-label="Description"] button'),
  ].find((button) => button.textContent?.trim() === 'Edit');
  edit?.click();
};

export const PrPageScene = ({ variant }: Props) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    applyPrPageSeed({ variant });
    setIsReady(true);
  }, [variant]);

  useEffect(() => {
    if (!isReady || (variant !== 'editing' && variant !== 'merge-methods')) {
      return;
    }
    const timer = window.setTimeout(() => {
      if (variant === 'editing') {
        openEditors();
        return;
      }
      press({ selector: '[data-branch-primary="pullRequest.merge"]' });
    }, OPEN_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [isReady, variant]);

  if (!isReady) {
    return null;
  }

  return (
    <main
      className="h-screen overflow-hidden bg-background text-foreground"
      style={variant === 'narrow' ? { width: NARROW_PANE_PX } : undefined}
    >
      <BranchPage session={SESSION} workingDir={PR_PAGE_WORKTREE} />
    </main>
  );
};
