export type WindowCloseDecision = 'close' | 'hide' | 'hold';

export type WindowCloseGuard = () => Promise<WindowCloseDecision>;

export const WINDOW_CLOSE_FALLBACK_MS = 2_000;

type Params = Readonly<{
  guard: WindowCloseGuard;
  fallbackMs?: number;
}>;

export const decideWindowClose = async ({
  guard,
  fallbackMs = WINDOW_CLOSE_FALLBACK_MS,
}: Params): Promise<WindowCloseDecision> => {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const fallback = new Promise<WindowCloseDecision>((resolve) => {
    timer = setTimeout(() => resolve('close'), fallbackMs);
  });
  const decided = guard().then(
    (decision) => decision,
    (): WindowCloseDecision => 'close',
  );
  try {
    return await Promise.race([decided, fallback]);
  } finally {
    if (timer !== null) {
      clearTimeout(timer);
    }
  }
};
