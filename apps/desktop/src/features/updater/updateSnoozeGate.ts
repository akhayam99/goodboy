const THREE_DAYS_MS = 3 * 24 * 60 * 60_000;

export type UpdateSnoozeGateParams = {
  readonly version: string | null;
  readonly snoozedVersion: string | null;
  readonly snoozedAt: string | null;
  readonly nowMs: number;
};

export const shouldShowArrivalCard = ({
  version,
  snoozedVersion,
  snoozedAt,
  nowMs,
}: UpdateSnoozeGateParams): boolean => {
  if (version === null) {
    return false;
  }
  if (snoozedVersion === null || snoozedVersion !== version) {
    return true;
  }
  if (snoozedAt === null) {
    return true;
  }
  const snoozedAtMs = new Date(snoozedAt).getTime();
  if (Number.isNaN(snoozedAtMs)) {
    return true;
  }
  return nowMs - snoozedAtMs >= THREE_DAYS_MS;
};
