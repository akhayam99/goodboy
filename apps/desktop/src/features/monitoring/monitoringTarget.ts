export type MonitoringTarget = {
  readonly workspaceId: string;
  readonly projectId: string;
  readonly branch: string;
};

type KeyParams = {
  readonly target: MonitoringTarget | null;
};

export const monitoringTargetKey = ({ target }: KeyParams): string =>
  target === null ? 'all' : `${target.projectId}:${target.branch}`;
