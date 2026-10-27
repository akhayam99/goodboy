export type CloneHostKey = 'github' | 'gitlab' | 'bitbucket';

export type CloneRoute = 'git' | 'gh' | 'glab';

export type CloneProbe = {
  readonly route: CloneRoute;
  readonly host: CloneHostKey;
  readonly name: string;
};

export type CloneDone = {
  readonly path: string;
};

export type CloneProgress = {
  readonly requestId: string;
  readonly phase: string;
  readonly percent: number;
};
