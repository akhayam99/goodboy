import { useEffect, useRef } from 'react';
import type { WorkspaceId } from '@goodboy/types';
import { useAppStore, useAttentionElsewhere, useCurrentWorkspace } from '../../../../store';
import { useNowSessions } from '../../../../shared/hooks/useNowSessions';
import { useShowToast } from '../../../../shared/components/Toast/useShowToast';
import { attentionPlace } from '../../../session/attentionPlace';
import {
  focusWindow,
  currentWindowLabel,
  isAnyWindowFocused,
  isMainWindow,
} from '../../../workspace/window';
import { awayBannersOf, type AwayBanner } from '../../away/awayBannersOf';
import { useAwayAlertsStore } from '../../away/awayAlertsStore';
import { bannerCandidatesOf } from '../../away/bannerCandidatesOf';
import { listenBannerTaps, type BannerTap } from '../../away/listenBannerTaps';
import { recentBannersOf } from '../../away/recentBannersOf';
import { setDockBadge } from '../../away/setDockBadge';
import { showAwayBanner } from '../../away/showAwayBanner';

type Seen = {
  readonly workspaceId: WorkspaceId | null;
  readonly keys: ReadonlySet<string>;
};

type ReportParams = {
  readonly title: string;
  readonly error: unknown;
};

const reportOnce = ({ title, error }: ReportParams): void => {
  void useAppStore.getState().reportError({ title, error, coalesceKey: 'away-alerts' });
};

type OpenTapParams = {
  readonly tap: BannerTap;
  readonly workspaceId: WorkspaceId;
};

const openTap = ({ tap, workspaceId }: OpenTapParams): void => {
  if (tap.workspaceId !== workspaceId) {
    return;
  }
  void focusWindow(currentWindowLabel());
  const state = useAppStore.getState();
  const { sessionId } = tap;
  if (sessionId === null || !state.sessions.some((session) => session.id === sessionId)) {
    return;
  }
  state.navigate({ to: attentionPlace({ state, sessionId, reason: tap.reason }) });
};

type DeliverParams = {
  readonly banners: ReadonlyArray<AwayBanner>;
};

export const useAwayAlerts = (): void => {
  const { attention } = useNowSessions({});
  const workspace = useCurrentWorkspace();
  const workspaceId = workspace?.id ?? null;
  const workspaceName = workspace?.name ?? '';
  const showToast = useShowToast();
  const isBadgeOn = useAwayAlertsStore((state) => state.isBadgeOn);
  const elsewhere = useAttentionElsewhere({ currentId: workspaceId });
  const seen = useRef<Seen | null>(null);
  const sentAt = useRef<ReadonlyArray<number>>([]);
  const hasAsked = useRef(false);
  const liveKeys = useRef<ReadonlySet<string>>(new Set());
  const badgeCount = isBadgeOn ? attention.count + elsewhere.count : 0;

  useEffect(() => {
    if (!isMainWindow()) {
      return;
    }
    setDockBadge({ count: badgeCount }).catch((error: unknown) =>
      reportOnce({ title: "Couldn't update the dock badge", error }),
    );
  }, [badgeCount]);

  useEffect(() => {
    if (!isMainWindow()) {
      return;
    }
    return () => {
      setDockBadge({ count: 0 }).catch((error: unknown) =>
        reportOnce({ title: "Couldn't clear the dock badge", error }),
      );
    };
  }, []);

  useEffect(() => {
    if (workspaceId === null) {
      return;
    }
    let off: () => void = () => undefined;
    let isLive = true;
    listenBannerTaps({ onTap: ({ tap }) => openTap({ tap, workspaceId }) })
      .then((unlisten) => {
        if (!isLive) {
          unlisten();
          return;
        }
        off = unlisten;
      })
      .catch((error: unknown) => reportOnce({ title: "Couldn't listen for banner clicks", error }));
    return () => {
      isLive = false;
      off();
    };
  }, [workspaceId]);

  useEffect(() => {
    const askOnce = (): void => {
      if (hasAsked.current) {
        return;
      }
      hasAsked.current = true;
      showToast({
        kind: 'info',
        persist: true,
        title: 'Banners while you are away',
        message: 'Goodboy can tell you when an agent needs you.',
        action: {
          label: 'Turn on',
          onClick: () => useAwayAlertsStore.getState().setBannerChoice({ choice: 'on' }),
        },
        onDismiss: () => {
          if (useAwayAlertsStore.getState().bannerChoice === 'unasked') {
            useAwayAlertsStore.getState().setBannerChoice({ choice: 'off' });
          }
        },
      });
    };

    const deliver = async ({ banners }: DeliverParams): Promise<void> => {
      if (workspaceId === null || (await isAnyWindowFocused())) {
        return;
      }
      const { bannerChoice } = useAwayAlertsStore.getState();
      if (bannerChoice === 'off') {
        return;
      }
      if (bannerChoice === 'unasked') {
        askOnce();
        return;
      }
      const stillWaiting = banners.filter((banner) =>
        banner.keys.some((key) => liveKeys.current.has(key)),
      );
      for (const banner of stillWaiting) {
        const outcome = await showAwayBanner({ banner, workspaceId });
        if (outcome === 'denied') {
          useAwayAlertsStore.getState().setBannerChoice({ choice: 'off' });
          showToast({
            kind: 'warning',
            title: 'Banners are blocked',
            message: 'Allow Goodboy in system notification settings, then turn banners on.',
          });
          return;
        }
        const nowMs = Date.now();
        sentAt.current = [
          ...recentBannersOf({ sentAt: sentAt.current, nowMs }),
          ...banner.keys.map(() => nowMs),
        ];
      }
    };

    const candidates = bannerCandidatesOf({
      state: useAppStore.getState(),
      sessions: attention.countedSessions,
    });
    const previous = seen.current;
    const keys = new Set(candidates.map((candidate) => candidate.key));
    seen.current = { workspaceId, keys };
    liveKeys.current = keys;
    if (previous === null || previous.workspaceId !== workspaceId) {
      return;
    }
    const banners = awayBannersOf({
      previousKeys: previous.keys,
      candidates,
      recentCount: recentBannersOf({ sentAt: sentAt.current, nowMs: Date.now() }).length,
      workspaceName,
    });
    if (banners.length === 0) {
      return;
    }
    deliver({ banners }).catch((error: unknown) =>
      reportOnce({ title: "Couldn't show a banner", error }),
    );
  }, [attention.countedSessions, workspaceId, workspaceName, showToast]);
};
