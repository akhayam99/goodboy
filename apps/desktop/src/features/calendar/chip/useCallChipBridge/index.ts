import { useEffect, useRef } from 'react';
import type { SessionAttentionReason, SessionId, WorkspaceId } from '@goodboy/types';
import { useAppStore, useCurrentWorkspace } from '../../../../store';
import { stageInfoOf } from '../../../../store/slices/session-view/stageInfoOf';
import { useNowSessions } from '../../../../shared/hooks/useNowSessions';
import { openDestination } from '../../../../shared/navigation/openDestination';
import { joinFacts } from '../../../../shared/utils/joinFacts';
import { formatClock } from '../../../../shared/utils/time/formatClock';
import { attentionPlace } from '../../../session/attentionPlace';
import {
  focusWindow,
  isAnyWindowFocused,
  isMainWindow,
  MAIN_WINDOW_LABEL,
} from '../../../workspace/window';
import type { AwayBanner } from '../../../notifications/away/awayBannersOf';
import { useAwayAlertsStore } from '../../../notifications/away/awayAlertsStore';
import { useCallQuietStore } from '../../../notifications/away/callQuietStore';
import { listenCallBannerTaps } from '../../../notifications/away/listenCallBannerTaps';
import { showAwayBanner } from '../../../notifications/away/showAwayBanner';
import { showCallBanner } from '../../../notifications/away/showCallBanner';
import { linkHostOf } from '../../linkHostOf';
import { listCalendarEvents } from '../../listCalendarEvents';
import { applyChipInput } from '../applyChipInput';
import { beforeCallRowsOf } from '../beforeCallRowsOf';
import { callChipCommands } from '../callChipCommands';
import { callChipEvents } from '../callChipEvents';
import { useCallChipStore } from '../callChipStore';
import type { CallAlert, ChipAction, ChipCall } from '../callChipTypes';
import { callChipViewOf } from '../callChipViewOf';
import { callsOf } from '../callsOf';
import { reportChipError } from '../reportChipError';

const LOAD_EVERY_MS = 5 * 60_000;
const LOOK_BACK_MS = 60 * 60_000;
const LOOK_AHEAD_MS = 3 * 60 * 60_000;
const FIRST_HEIGHT = 120;

type Target = Readonly<{
  sessionId: SessionId;
  reason: SessionAttentionReason | null;
}>;

type RowParams = {
  readonly rowKey: string;
};

type CallParams = {
  readonly call: ChipCall;
};

type ReleaseParams = {
  readonly held: ReadonlyArray<AwayBanner>;
  readonly workspaceId: WorkspaceId | null;
};

type Subscribe = () => Promise<() => void>;

type SubscribeParams = {
  readonly start: Subscribe;
};

const subscribe = ({ start }: SubscribeParams): (() => void) => {
  let stop: (() => void) | null = null;
  let isLive = true;
  start()
    .then((teardown) => {
      if (!isLive) {
        teardown();
        return;
      }
      stop = teardown;
    })
    .catch((error: unknown) => reportChipError({ title: "Couldn't listen for calls", error }));
  return () => {
    isLive = false;
    stop?.();
  };
};

const targetOf = ({ rowKey }: RowParams): Target | null => {
  const chip = useCallChipStore.getState().state;
  if (chip.kind === 'after') {
    const banner = chip.held.find((held) => (held.keys[0] ?? held.title) === rowKey);
    if (banner === undefined || banner.sessionId === null) {
      return null;
    }
    return { sessionId: banner.sessionId, reason: banner.reason };
  }
  const state = useAppStore.getState();
  const session = state.sessions.find((candidate) => candidate.id === rowKey);
  if (session === undefined) {
    return null;
  }
  return { sessionId: session.id, reason: stageInfoOf(state, session).attention };
};

const openRow = async ({ rowKey }: RowParams): Promise<void> => {
  const target = targetOf({ rowKey });
  if (target === null) {
    return;
  }
  await focusWindow(MAIN_WINDOW_LABEL);
  const state = useAppStore.getState();
  state.navigate({ to: attentionPlace({ state, ...target }) });
};

const bannerOnce = async ({ call }: CallParams): Promise<void> => {
  await showCallBanner({
    eventId: call.id,
    title: call.title,
    body: joinFacts({ facts: [formatClock({ at: call.start }), linkHostOf({ link: call.link })] }),
  });
};

const release = async ({ held, workspaceId }: ReleaseParams): Promise<void> => {
  if (held.length === 0 || workspaceId === null) {
    return;
  }
  if (useAwayAlertsStore.getState().bannerChoice !== 'on' || (await isAnyWindowFocused())) {
    return;
  }
  for (const banner of held) {
    await showAwayBanner({ banner, workspaceId });
  }
};

type EndParams = CallParams & {
  readonly workspaceId: WorkspaceId | null;
  readonly now: number;
};

type WorkspaceParams = {
  readonly workspaceId: WorkspaceId | null;
  readonly now: number;
};

type AlertParams = {
  readonly payload: CallAlert;
};

type ActionParams = {
  readonly payload: ChipAction;
};

const endCall = async ({ call, workspaceId, now }: EndParams): Promise<void> => {
  const held = useCallQuietStore.getState().endQuiet({ eventId: call.id });
  applyChipInput({ input: { kind: 'ended', call, held }, now });
  if (useCallChipStore.getState().state.kind === 'after') {
    return;
  }
  await release({ held, workspaceId });
};

const endMissedCall = async ({ workspaceId, now }: WorkspaceParams): Promise<void> => {
  const chip = useCallChipStore.getState().state;
  if (chip.kind === 'in-call' && now >= chip.call.end) {
    await endCall({ call: chip.call, workspaceId, now });
    return;
  }
  const { quiet } = useCallQuietStore.getState();
  if (quiet === null || now < quiet.until) {
    return;
  }
  const held = useCallQuietStore.getState().endQuiet({ eventId: quiet.eventId });
  await release({ held, workspaceId });
};

export const useCallChipBridge = (): void => {
  const sources = useAppStore((state) => state.calendarSources);
  const roles = useAppStore((state) => state.calendarRoles);
  const { needsYou } = useNowSessions({});
  const workspaceId = useCurrentWorkspace()?.id ?? null;
  const chip = useCallChipStore((state) => state.state);
  const heldCount = useCallQuietStore((state) => state.held.length);
  const calls = useRef<ReadonlyMap<string, ChipCall>>(new Map());
  const bannered = useRef<Set<string>>(new Set());
  const isShown = useRef(false);
  const workspace = useRef(workspaceId);
  workspace.current = workspaceId;

  useEffect(() => {
    if (!isMainWindow()) {
      return;
    }
    void useAppStore.getState().loadCalendarSources();
  }, []);

  useEffect(() => {
    if (!isMainWindow()) {
      return;
    }
    let isLive = true;
    let latest = 0;
    const load = async (): Promise<void> => {
      latest += 1;
      const mine = latest;
      const now = Date.now();
      await endMissedCall({ workspaceId: workspace.current, now });
      const refs = sources.map((source) => ({ id: source.id, kind: source.kind }));
      const listed =
        refs.length === 0
          ? []
          : (
              await listCalendarEvents({
                sources: refs,
                from: now - LOOK_BACK_MS,
                to: now + LOOK_AHEAD_MS,
              })
            ).items;
      if (!isLive || mine !== latest) {
        return;
      }
      const found = callsOf({ events: listed, roles, now });
      calls.current = new Map(found.map((call) => [call.id, call]));
      await callChipCommands.arm({
        calls: found.map((call) => ({ eventId: call.id, start: call.start, end: call.end })),
      });
    };
    const run = (): void => {
      load().catch((error: unknown) =>
        reportChipError({ title: "Couldn't check your next calls", error }),
      );
    };
    run();
    const timer = setInterval(run, LOAD_EVERY_MS);
    return () => {
      isLive = false;
      clearInterval(timer);
    };
  }, [sources, roles]);

  useEffect(() => {
    if (!isMainWindow()) {
      return;
    }
    const onAlert = ({ payload }: AlertParams): void => {
      const call = calls.current.get(payload.eventId);
      if (call === undefined) {
        return;
      }
      const now = Date.now();
      if (payload.moment === 'ended') {
        endCall({ call, workspaceId: workspace.current, now }).catch((error: unknown) =>
          reportChipError({ title: "Couldn't close the call chip", error }),
        );
        return;
      }
      if (!useAwayAlertsStore.getState().isCallChipOn) {
        if (!bannered.current.has(call.id)) {
          bannered.current.add(call.id);
          void bannerOnce({ call });
        }
        return;
      }
      applyChipInput({ input: { kind: 'alert', moment: payload.moment, call }, now });
    };
    const onAction = ({ payload }: ActionParams): void => {
      if (payload.kind === 'open') {
        openRow({ rowKey: payload.rowKey }).catch((error: unknown) =>
          reportChipError({ title: "Couldn't open this from the call chip", error }),
        );
        return;
      }
      applyChipInput({ input: { kind: payload.kind }, now: Date.now() });
    };
    const stops = [
      subscribe({ start: () => callChipEvents.alerts({ onEvent: onAlert }) }),
      subscribe({ start: () => callChipEvents.actions({ onEvent: onAction }) }),
      subscribe({
        start: () =>
          listenCallBannerTaps({
            onTap: () => {
              void focusWindow(MAIN_WINDOW_LABEL).then(() => openDestination({ id: 'calendar' }));
            },
          }),
      }),
    ];
    return () => {
      for (const stop of stops) {
        stop();
      }
    };
  }, []);

  useEffect(() => {
    if (!isMainWindow()) {
      return;
    }
    const waiting = beforeCallRowsOf({ state: useAppStore.getState(), sessions: needsYou });
    const view = callChipViewOf({ state: chip, waiting, heldCount });
    if (view === null) {
      if (!isShown.current) {
        return;
      }
      isShown.current = false;
      callChipCommands
        .hide()
        .catch((error: unknown) =>
          reportChipError({ title: "Couldn't hide the call chip", error }),
        );
      return;
    }
    callChipCommands
      .show({ view, height: FIRST_HEIGHT })
      .then(() => {
        isShown.current = true;
      })
      .catch((error: unknown) => {
        if (chip.kind === 'hidden' || bannered.current.has(chip.call.id)) {
          return;
        }
        bannered.current.add(chip.call.id);
        reportChipError({ title: "Couldn't show the call chip", error });
        void bannerOnce({ call: chip.call });
      });
  }, [chip, needsYou, heldCount]);
};
