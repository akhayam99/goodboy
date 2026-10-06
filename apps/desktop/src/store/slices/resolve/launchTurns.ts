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

export const dropLaunchTurns = ({ launchId }: { readonly launchId: string }): void => {
  turnsByLaunch.delete(launchId);
};
