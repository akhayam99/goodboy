export type RemoteProbe =
  | { readonly kind: 'no-remote' }
  | { readonly kind: 'unreachable'; readonly reason: string }
  | { readonly kind: 'reachable-no-main' }
  | { readonly kind: 'main-present'; readonly branch: string; readonly sha: string };
