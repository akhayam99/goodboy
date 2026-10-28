export type LaunchTurn = {
  readonly threadIds: ReadonlyArray<string>;
  readonly content: string;
};

const turnsByLaunch = new Map<string, Array<LaunchTurn>>();

export const queueLaunchTurns = ({
  launchId,
  turns,
}: {
  readonly launchId: string;
  readonly turns: ReadonlyArray<LaunchTurn>;
}): void => {
  if (turns.length === 0) {
    return;
  }
  turnsByLaunch.set(launchId, [...turns]);
};

export const hasLaunchTurns = ({ launchId }: { readonly launchId: string }): boolean =>
  (turnsByLaunch.get(launchId)?.length ?? 0) > 0;

export const takeLaunchTurn = ({ launchId }: { readonly launchId: string }): LaunchTurn | null => {
  const queue = turnsByLaunch.get(launchId);
  const next = queue?.shift() ?? null;
  if (queue?.length === 0) {
    turnsByLaunch.delete(launchId);
  }
  return next;
};

type HeldParams = {
  readonly threadId: string;
};

export const heldLaunchIdOf = ({ threadId }: HeldParams): string | null => {
  for (const [launchId, turns] of turnsByLaunch) {
    if (turns.some((turn) => turn.threadIds.includes(threadId))) {
      return launchId;
    }
  }
  return null;
};

export const dropLaunchTurns = ({ launchId }: { readonly launchId: string }): void => {
  turnsByLaunch.delete(launchId);
};
