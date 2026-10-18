import { useEffect } from 'react';
import { applyDocumentTheme } from '../../../../../shared/lib/theme';
import { BrandTile } from '../../../../../shared/components/BrandTile';

type Props = {
  readonly theme: 'dark' | 'light';
};

const HERO_TILE_PX = 84;
const HOME_TILE_PX = 40;
const HEADER_TILE_PX = 22;
const CAPTION = 'text-meta text-faint-foreground';

export const BrandTileScene = ({ theme }: Props) => {
  useEffect(() => {
    applyDocumentTheme({ theme });
  }, [theme]);
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-background text-foreground">
      <div className="flex items-end gap-16">
        <div className="flex flex-col items-center gap-3">
          <BrandTile size={HERO_TILE_PX} />
          <span className={CAPTION}>Welcome {HERO_TILE_PX}</span>
        </div>
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-3">
            <BrandTile size={HOME_TILE_PX} />
            <div className="flex flex-col">
              <span className="text-title">Goodboy</span>
              <span className={CAPTION}>v0.27.2</span>
            </div>
          </div>
          <span className={CAPTION}>Home {HOME_TILE_PX}</span>
        </div>
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-2">
            <BrandTile size={HEADER_TILE_PX} />
            <span className="text-chip">Goodboy</span>
          </div>
          <span className={CAPTION}>Setup header {HEADER_TILE_PX}</span>
        </div>
      </div>
    </div>
  );
};
