import type { ArtifactLinkModel } from './artifactLinksOf';

type Params = {
  readonly link: ArtifactLinkModel;
};

export const isAwaitingApproval = ({ link }: Params): boolean =>
  link.approval?.state === 'needs_approval' || link.approval?.state === 'revising';
