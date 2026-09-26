import type { WireframeScreen } from '@goodboy/core';
import { Eyebrow, WorkNode } from '@goodboy/ui';
import { frameUrl } from '../../frame/frameUrl';
import { screenPagePath } from '../../wireframePagePath';
import { VIEWPORT_MIN_HEIGHT, VIEWPORT_WIDTH } from '../../wireframePalette';

const TILE_WIDTH = 240;

type Props = {
  readonly stageId: string;
  readonly screens: ReadonlyArray<WireframeScreen>;
  readonly currentScreenId: string | null;
  readonly onOpenScreen: (screenId: string) => void;
};

export const ScreenGrid = ({ stageId, screens, currentScreenId, onOpenScreen }: Props) => (
  <section
    aria-label="Screens"
    data-testid="wireframe-screen-grid"
    className="flex min-w-0 flex-col gap-3"
  >
    <div className="flex items-baseline gap-2">
      <h3>
        <Eyebrow label="Screens" />
      </h3>
      <span className="tabular-nums text-secondary text-muted-foreground">{screens.length}</span>
    </div>
    <ol className="flex flex-wrap items-start gap-6">
      {screens.map((screen, index) => {
        const width = VIEWPORT_WIDTH[screen.viewport];
        const height = VIEWPORT_MIN_HEIGHT[screen.viewport];
        const scale = TILE_WIDTH / width;
        return (
          <li key={screen.id} data-testid="wireframe-grid-item">
            <button
              type="button"
              onClick={() => onOpenScreen(screen.id)}
              aria-current={screen.id === currentScreenId ? 'page' : undefined}
              className="flex flex-col gap-2 rounded-md text-left hover:text-foreground"
            >
              <span
                className="block overflow-hidden rounded-md border border-border-soft bg-background"
                style={{ width: TILE_WIDTH, height: height * scale }}
              >
                <iframe
                  title={`${screen.title} preview`}
                  src={frameUrl({
                    stageId,
                    path: screenPagePath({ screenId: screen.id, state: null }),
                  })}
                  sandbox="allow-scripts"
                  loading="lazy"
                  tabIndex={-1}
                  aria-hidden
                  className="pointer-events-none block border-0"
                  style={{
                    width,
                    height,
                    transform: `scale(${scale})`,
                    transformOrigin: '0 0',
                  }}
                />
              </span>
              <span className="flex min-w-0 items-center gap-2 text-body">
                <WorkNode
                  state={screen.id === currentScreenId ? 'ready' : 'queued'}
                  mark={{ kind: 'index', value: String(index + 1) }}
                  label={`Screen ${index + 1}`}
                />
                <span className="min-w-0 truncate">{screen.title}</span>
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  </section>
);
