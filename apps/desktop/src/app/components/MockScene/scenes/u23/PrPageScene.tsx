import { useEffect, useState } from 'react';
import { RemoteImageLoaderProvider } from '@goodboy/ui';
import { BranchPage } from '../../../../../features/branch/components/BranchPage';
import { WorktreeSceneColumn } from '../WorktreeSceneColumn';
import { SESSION } from '../resolveSeed';
import { PR_PAGE_WORKTREE, applyPrPageSeed, type PrPageVariant } from './prPageSeed';

const NARROW_PANE_PX = 860;
const OPEN_DELAY_MS = 500;

const MOCK_PICTURE =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><rect width="20" height="20" fill="steelblue"/><circle cx="10" cy="8" r="4" fill="white"/><rect x="3" y="13" width="14" height="7" rx="3.5" fill="white"/></svg>',
  );

type Props = {
  readonly variant: PrPageVariant;
};

type PictureParams = {
  readonly url: string;
};

const loadMockPicture = async ({ url }: PictureParams): Promise<string> => {
  if (url.includes('/miss/')) {
    throw new Error('no picture');
  }
  return MOCK_PICTURE;
};

const press = ({ selector }: { readonly selector: string }): void => {
  document.querySelector<HTMLElement>(selector)?.click();
};

const openEditors = (): void => {
  press({ selector: 'button[aria-keyshortcuts="E"]' });
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
      <RemoteImageLoaderProvider load={loadMockPicture} loadAvatar={loadMockPicture}>
        <WorktreeSceneColumn>
          <BranchPage session={SESSION} workingDir={PR_PAGE_WORKTREE} />
        </WorktreeSceneColumn>
      </RemoteImageLoaderProvider>
    </main>
  );
};
