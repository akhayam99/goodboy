import { useCallback, useEffect, useRef, useState } from 'react';
import { DURATION_BASE_MS, DURATION_QUICK_MS, canAnimate } from '@goodboy/ui';
import { announce } from '../../../../shared/lib/announcer';
import type { GridEditing, StepParams } from '../../grid/gridEditingTypes';
import type { HomeWidgetId } from '../../grid/homeWidgets';
import type { WidgetGesture } from '../../layout/layoutTypes';
import { neighbourOf } from '../../layout/neighbourOf';
import { stepMoveOf } from '../../layout/stepMoveOf';
import { orderAfterMove } from '../../reorder/orderAfterMove';
import { reorderMessageOf } from '../../reorder/reorderMessageOf';
import { STEP_DELAY_MS } from '../../reorder/stepDelay';
import type { FocusTarget } from '../useFocusAfterGesture';
import type { HomeLayoutState } from '../useHomeLayout';

type FocusParams = {
  readonly target: FocusTarget;
};

type Params = {
  readonly layout: HomeLayoutState;
  readonly ids: ReadonlyArray<HomeWidgetId>;
  readonly focusAfter: (params: FocusParams) => void;
};

type HomeEditing = {
  readonly editing: GridEditing;
  readonly hide: (params: WidgetGesture) => void;
  readonly show: (params: WidgetGesture) => void;
};

type Pending = {
  readonly timer: ReturnType<typeof setTimeout>;
  readonly run: () => void;
};

export const useHomeEditing = ({ layout, ids, focusAfter }: Params): HomeEditing => {
  const [leavingId, setLeavingId] = useState<HomeWidgetId | null>(null);
  const [arrivingId, setArrivingId] = useState<HomeWidgetId | null>(null);
  const pendingRef = useRef<Pending | null>(null);
  const arrivalRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestRef = useRef({ layout, ids, focusAfter });
  latestRef.current = { layout, ids, focusAfter };

  const flushPending = useCallback((): void => {
    const pending = pendingRef.current;
    if (pending === null) {
      return;
    }
    clearTimeout(pending.timer);
    pendingRef.current = null;
    pending.run();
  }, []);

  const hide = useCallback(
    ({ id }: WidgetGesture): void => {
      flushPending();
      const run = () => {
        const { layout: current, ids: shown, focusAfter: focus } = latestRef.current;
        pendingRef.current = null;
        setLeavingId(null);
        focus({ target: neighbourOf({ ids: shown, id }) ?? 'tray' });
        current.hide({ id });
      };
      const grid = document.querySelector('[data-home-grid]');
      if (!canAnimate({ element: grid })) {
        run();
        return;
      }
      setLeavingId(id);
      pendingRef.current = { timer: setTimeout(run, DURATION_QUICK_MS + STEP_DELAY_MS), run };
    },
    [flushPending],
  );

  const show = useCallback(({ id }: WidgetGesture): void => {
    const { layout: current, focusAfter: focus } = latestRef.current;
    current.show({ id });
    focus({ target: id });
    if (arrivalRef.current !== null) {
      clearTimeout(arrivalRef.current);
    }
    setArrivingId(id);
    arrivalRef.current = setTimeout(() => {
      arrivalRef.current = null;
      setArrivingId(null);
    }, DURATION_BASE_MS);
  }, []);

  const onStepMove = useCallback(({ id, step }: StepParams): void => {
    const { layout: current, ids: shown } = latestRef.current;
    const moved = stepMoveOf({ ids: shown, id, step });
    if (moved === null) {
      return;
    }
    current.move({ id, beforeId: moved.beforeId });
    announce({
      message: reorderMessageOf({
        kind: 'step',
        id,
        ids: orderAfterMove({ ids: shown, id, toIndex: moved.position - 1 }),
      }),
    });
  }, []);

  useEffect(
    () => () => {
      if (pendingRef.current !== null) {
        clearTimeout(pendingRef.current.timer);
      }
      if (arrivalRef.current !== null) {
        clearTimeout(arrivalRef.current);
      }
    },
    [],
  );

  return {
    editing: {
      onHide: hide,
      onReorder: layout.move,
      onResize: layout.resize,
      onStepMove,
      leavingId,
      arrivingId,
    },
    hide,
    show,
  };
};
