import { useEffect } from 'react';
import { useAppStore } from '../../../../../store';
import { SettingsFrame } from '../audit/SettingsFrame';
import { useSceneClicks } from '../audit/useSceneClicks';
import { seedStorageScene } from '../brand/StorageScene';
import { CommitsBranchScene } from '../u24/CommitsBranchScene';

type Variant = 'commits' | 'menu' | 'storage' | 'branches';

type Props = {
  readonly variant: Variant;
};

type Hover = {
  readonly selector: string;
  readonly index: number;
};

type HoverParams = {
  readonly hover: Hover | null;
};

const HOVER_STYLE = `[data-scene-hover] { background-image: linear-gradient(var(--color-overlay-hover), var(--color-overlay-hover)); }
[data-scene-hover] .row-actions { opacity: 1; }`;

const HOVER_POLL_MS = 200;

const CLICK_MS = 600;

const HOVERS: Readonly<Record<Variant, Hover | null>> = {
  commits: { selector: '[role="listitem"]', index: 1 },
  menu: null,
  storage: { selector: '[data-testid="storage-folder-row"]', index: 1 },
  branches: { selector: 'li[data-select-id]', index: 1 },
};

const CLICKS: Readonly<Record<Variant, ReadonlyArray<string>>> = {
  commits: [],
  menu: ['More for'],
  storage: [],
  branches: [],
};

const useSceneHover = ({ hover }: HoverParams): void => {
  useEffect(() => {
    if (hover === null) {
      return;
    }
    const id = window.setInterval(() => {
      const row = document.querySelectorAll(hover.selector)[hover.index];
      if (row !== undefined && !row.hasAttribute('data-scene-hover')) {
        row.setAttribute('data-scene-hover', 'true');
      }
    }, HOVER_POLL_MS);
    return () => window.clearInterval(id);
  }, [hover]);
};

const seedQuietStorage = (): void => {
  seedStorageScene();
  useAppStore.setState({
    openSecurityFindings: {},
    dismissedSecurityFindings: {},
    loadSecurityFindings: async () => undefined,
  });
};

const QuietRowsScene = ({ variant }: Props) => {
  useSceneHover({ hover: HOVERS[variant] });
  useSceneClicks({
    isReady: true,
    labels: CLICKS[variant],
    selector: 'button',
    match: 'prefix',
    intervalMs: CLICK_MS,
  });
  return (
    <>
      <style>{HOVER_STYLE}</style>
      {variant === 'storage' ? (
        <SettingsFrame focus={{ scope: 'app', section: 'storage' }} seed={seedQuietStorage} />
      ) : variant === 'branches' ? (
        <SettingsFrame
          focus={{ scope: 'workspace', section: 'branches' }}
          seed={seedStorageScene}
        />
      ) : (
        <CommitsBranchScene isPlanned={false} />
      )}
    </>
  );
};

export const U26S_QUIET_ROWS_SCENES = {
  'u26s-rows-commits': () => <QuietRowsScene variant="commits" />,
  'u26s-rows-menu': () => <QuietRowsScene variant="menu" />,
  'u26s-rows-storage': () => <QuietRowsScene variant="storage" />,
  'u26s-rows-branches': () => <QuietRowsScene variant="branches" />,
};
