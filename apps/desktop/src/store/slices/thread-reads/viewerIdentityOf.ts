import type {
  BitbucketIntegrationBinding,
  GitlabIntegrationBinding,
  IntegrationBinding,
  ProjectId,
  SessionId,
} from '@goodboy/types';
import type { AppState } from '../../types';
import type { ReviewSourceEntry } from '../review-source/types';
import { sessionById } from '../sessions/sessionIndex';

type Params = {
  readonly state: Pick<
    AppState,
    'githubStatus' | 'githubWorkspaceStatus' | 'workspaceIntegrations' | 'sessions'
  >;
  readonly sessionId: SessionId;
  readonly entry: Pick<ReviewSourceEntry, 'kind' | 'projectId' | 'url'> | null;
};

type BindingsParams<Binding extends IntegrationBinding> = {
  readonly bindings: ReadonlyArray<Binding>;
  readonly projectId: ProjectId | null;
};

type ValueParams = {
  readonly value: string;
};

const hostnameOf = ({ value }: ValueParams): string => {
  const withoutScheme = value.trim().split('://').pop() ?? '';
  return (withoutScheme.split('/')[0] ?? '').toLowerCase();
};

const canonicalIdOf = ({ value }: ValueParams): ReadonlySet<string> | null =>
  value === '' ? null : new Set([value.toLowerCase()]);

const mostSpecificOf = <Binding extends IntegrationBinding>({
  bindings,
  projectId,
}: BindingsParams<Binding>): Binding | null =>
  bindings.find((binding) => projectId !== null && binding.projectId === projectId) ??
  bindings.find((binding) => binding.projectId === null) ??
  null;

export const viewerIdentityOf = ({
  state,
  sessionId,
  entry,
}: Params): ReadonlySet<string> | null => {
  const session = sessionById(state.sessions, sessionId);
  if (session === undefined) {
    return null;
  }
  const kind = entry?.kind ?? 'github';
  if (kind === 'github') {
    const workspaceStatus = state.githubWorkspaceStatus?.[session.workspaceId];
    const user =
      workspaceStatus?.user ??
      (workspaceStatus?.scoped === true ? undefined : state.githubStatus?.user);
    return canonicalIdOf({ value: user ?? '' });
  }
  const bindings = state.workspaceIntegrations?.[session.workspaceId] ?? [];
  const projectId = entry?.projectId ?? null;
  if (kind === 'gitlab') {
    const host = entry?.url == null ? '' : hostnameOf({ value: entry.url });
    if (host === '') {
      return null;
    }
    const binding = mostSpecificOf({
      bindings: bindings.filter(
        (candidate): candidate is GitlabIntegrationBinding =>
          candidate.provider === 'gitlab' && hostnameOf({ value: candidate.config.host }) === host,
      ),
      projectId,
    });
    return binding === null ? null : canonicalIdOf({ value: binding.config.username ?? '' });
  }
  const binding = mostSpecificOf({
    bindings: bindings.filter(
      (candidate): candidate is BitbucketIntegrationBinding => candidate.provider === 'bitbucket',
    ),
    projectId,
  });
  return binding === null ? null : canonicalIdOf({ value: binding.config.nickname ?? '' });
};
