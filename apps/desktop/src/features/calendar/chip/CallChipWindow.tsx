import { useCallback, useEffect, useRef, useState } from 'react';
import { formatError } from '@goodboy/ui';
import { useNow } from '../../../shared/hooks/useNow';
import { CallChip } from './CallChip';
import { callChipCommands } from './callChipCommands';
import { callChipEvents } from './callChipEvents';
import type { ChipAction, ChipView } from './callChipTypes';
import { chipExpiryOf } from './chipExpiryOf';

type ActParams = {
  readonly action: ChipAction;
};

type FailParams = {
  readonly error: unknown;
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
  const [failure, setFailure] = useState<string | null>(null);
  const now = useNow(1_000);
  const frame = useRef<HTMLDivElement>(null);
  const fail = useCallback(({ error }: FailParams) => setFailure(formatError(error)), []);
  const act = useCallback(
    ({ action }: ActParams): void => {
      setFailure(null);
      callChipCommands.act({ action }).catch((error: unknown) => fail({ error }));
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
      .catch((error: unknown) => fail({ error }));
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
      callChipCommands
        .resize({ height: node.getBoundingClientRect().height })
        .catch((error: unknown) => fail({ error }));
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
      <CallChip view={shown.view} now={now} failure={failure} onAct={act} />
    </div>
  );
};
