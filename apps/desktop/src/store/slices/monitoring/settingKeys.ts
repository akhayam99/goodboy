type Params = {
  readonly projectId: string;
};

export const watchedPortsKey = ({ projectId }: Params): string =>
  `monitor.watchedPorts.${projectId}`;

export const learnedPortsKey = ({ projectId }: Params): string =>
  `monitor.learnedPorts.${projectId}`;
