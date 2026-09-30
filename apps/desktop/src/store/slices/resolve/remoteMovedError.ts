const shortOf = ({ sha }: { readonly sha: string | null }): string =>
  sha === null ? 'nothing' : sha.slice(0, 7);

const MOVED_MARKER = ' on the remote is at ';
const CARRIES_MARKER = ' on the remote carries work that ';
const GIT_REJECTION = /non-fast-forward|fetch first|\[rejected\]/i;

export const remoteMovedError = ({
  branch,
  remote,
  reviewed,
}: {
  readonly branch: string;
  readonly remote: string | null;
  readonly reviewed: string | null;
}): string =>
  `${branch}${MOVED_MARKER}${shortOf({ sha: remote })}, not the ${shortOf({ sha: reviewed })} you reviewed`;

export const remoteCarriesWorkError = ({
  branch,
  local,
}: {
  readonly branch: string;
  readonly local: string;
}): string =>
  `${branch}${CARRIES_MARKER}${shortOf({ sha: local })} does not contain, so nothing was pushed`;

export const isRemoteMovedError = ({ error }: { readonly error: string | null }): boolean =>
  error !== null &&
  (error.includes(MOVED_MARKER) || error.includes(CARRIES_MARKER) || GIT_REJECTION.test(error));
