type Params = {
  readonly src: string;
  readonly replayKey: number;
};

export const frameKey = ({ src, replayKey }: Params): string => `${src}#${replayKey}`;
