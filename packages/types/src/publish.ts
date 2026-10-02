export type PublishStep = 'check' | 'push' | 'head';

export type PublishOutcome =
  | { readonly kind: 'published'; readonly branch: string; readonly sha: string }
  | { readonly kind: 'remote-has-main'; readonly branch: string }
  | { readonly kind: 'no-remote' }
  | { readonly kind: 'nothing-to-publish' }
  | { readonly kind: 'failed'; readonly step: PublishStep; readonly message: string };

export type LinkedRemote = {
  readonly remoteUrl: string;
  readonly added: boolean;
};
