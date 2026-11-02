const SETTLE_WAIT_MS = 5_000;

type TrackParams = {
  readonly promise: Promise<void>;
};

let pending: Promise<void> | null = null;

const track = ({ promise }: TrackParams): void => {
  const own: Promise<void> = promise
    .catch((error) => console.error('verify workspace worktrees failed', error))
    .finally(() => {
      if (pending === own) {
        pending = null;
      }
    });
  pending = own;
};

const settled = async (): Promise<void> => {
  const current = pending;
  if (current === null) {
    return;
  }
  let timer: ReturnType<typeof setTimeout> | null = null;
  const gave = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, SETTLE_WAIT_MS);
  });
  await Promise.race([current, gave]);
  if (timer !== null) {
    clearTimeout(timer);
  }
};

export const workspaceVerification = { track, settled };
