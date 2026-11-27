import { useCallback, useEffect, useRef, useState } from 'react';
import { useNow } from '../../../shared/hooks/useNow';
import { CallChip } from './CallChip';
import { callChipCommands } from './callChipCommands';
import { callChipEvents } from './callChipEvents';
import type { ChipAction, ChipView } from './callChipTypes';
import { chipExpiryOf } from './chipExpiryOf';

type ActParams = {
  readonly action: ChipAction;
};

type ViewParams = {
  readonly view: ChipView | null;
};

type Shown = Readonly<{
  view: ChipView;
  shownAt: number;
}>;

export const CallChipWindow = () => {
  const [shown, setShown] = useState<Shown | null>(null);
  const [hasFailed, setHasFailed] = useState(false);
  const now = useNow(1_000);
  const frame = useRef<HTMLDivElement>(null);
  const fail = useCallback(() => setHasFailed(true), []);
  const act = useCallback(
    ({ action }: ActParams): void => {
      setHasFailed(false);
      callChipCommands.act({ action }).catch(fail);
    },
    [fail],
  );

  useEffect(() => {
    document.getElementById('boot-shell')?.remove();
  }, []);

  useEffect(() => {
    let isLive = true;
    let stop: () => void = () => undefined;
    const show = ({ view }: ViewParams): void => {
      if (isLive && view !== null) {
        setShown({ view, shownAt: Date.now() });
      }
    };
    callChipEvents
      .views({ onEvent: ({ payload }) => show({ view: payload }) })
      .then((unlisten) => {
        stop = unlisten;
        return callChipCommands.view();
      })
      .then((view) => show({ view }))
      .catch(fail);
    return () => {
      isLive = false;
      stop();
    };
  }, [fail]);

  useEffect(() => {
    const node = frame.current;
    if (node === null || shown === null) {
      return;
    }
    const observer = new ResizeObserver(() => {
      callChipCommands.resize({ height: node.getBoundingClientRect().height }).catch(fail);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [shown, fail]);

  const expiry = shown === null ? null : chipExpiryOf(shown);
  const isExpired = expiry !== null && now >= expiry;
  useEffect(() => {
    if (isExpired) {
      act({ action: { kind: 'hide' } });
    }
  }, [isExpired, act]);

  if (shown === null) {
    return null;
  }
  return (
    <div ref={frame} className="flex w-full min-w-0">
      <CallChip view={shown.view} now={now} hasFailed={hasFailed} onAct={act} />
    </div>
  );
};
