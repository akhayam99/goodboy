import { ChevronRight } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { Button, ICON_SIZE, cn } from '@goodboy/ui';
import type { Session, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import type { AppState } from '../../../store/types';
import { captureLocation } from '../../../store/slices/navigation/captureLocation';
import { crumbsOf, type Crumb } from '../../../store/slices/navigation/crumbsOf';

type Props = {
  readonly session: Session;
};

type CrumbParams = {
  readonly state: AppState;
  readonly sessionId: SessionId;
};

type OpenParams = {
  readonly index: number;
};

const NO_CRUMBS: ReadonlyArray<Crumb> = [];

const sessionCrumbsOf = ({ state, sessionId }: CrumbParams): ReadonlyArray<Crumb> => {
  const { place } = captureLocation({ state });
  if (place.at !== 'session' || place.sessionId !== sessionId) {
    return NO_CRUMBS;
  }
  return crumbsOf({ state, place });
};

export const SessionCrumbs = ({ session }: Props) => {
  const sessionId = session.id;
  const labels = useAppStore(
    useShallow((state) => sessionCrumbsOf({ state, sessionId }).map((crumb) => crumb.label)),
  );
  const open = ({ index }: OpenParams) => {
    const state = useAppStore.getState();
    const crumb = sessionCrumbsOf({ state, sessionId })[index];
    if (crumb === undefined) {
      return;
    }
    state.upTo({ to: crumb.place });
  };
  return (
    <nav aria-label="Breadcrumb" data-session-crumbs="" className="flex h-9 min-w-0 flex-1">
      <ol className="flex min-w-0 flex-1 items-center gap-1">
        {labels.map((label, index) => {
          const isCurrent = index === labels.length - 1;
          return (
            <li
              key={`${index}:${label}`}
              className={cn(
                'flex min-w-0 items-center gap-1',
                isCurrent ? 'flex-1' : index === 0 ? 'max-w-64 shrink' : 'shrink',
              )}
            >
              {index === 0 ? null : (
                <ChevronRight
                  size={ICON_SIZE.row}
                  aria-hidden
                  className="shrink-0 text-faint-foreground"
                />
              )}
              {isCurrent ? (
                <span
                  aria-current="page"
                  className={cn('min-w-0 truncate text-meta text-foreground', index > 0 && 'px-1')}
                >
                  {label}
                </span>
              ) : (
                <Button
                  variant="quiet"
                  size="xs"
                  data-crumb={index}
                  className={cn('min-w-0 max-w-full', index === 0 ? 'pl-0 pr-1' : 'px-1')}
                  onClick={() => open({ index })}
                >
                  <span className="min-w-0 truncate">{label}</span>
                </Button>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};
