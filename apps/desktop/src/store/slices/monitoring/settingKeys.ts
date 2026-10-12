type Params = {
  readonly projectId: string;
};

export const PINNED_PORTS_KEY = 'monitor.pinnedPorts';

export const HIDDEN_PORTS_KEY = 'monitor.hiddenPorts';

export const LEGACY_WATCHED_PORTS_PREFIX = 'monitor.watchedPorts.';

export const learnedPortsKey = ({ projectId }: Params): string =>
  `monitor.learnedPorts.${projectId}`;
