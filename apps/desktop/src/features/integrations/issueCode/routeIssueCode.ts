import type { ParsedIssueCode } from './parseIssueCode';

export type LookupProvider = 'linear' | 'jira' | 'github' | 'gitlab' | 'sentry';

export type LookupTarget =
  | { readonly provider: 'linear'; readonly identifier: string }
  | { readonly provider: 'jira'; readonly key: string }
  | { readonly provider: 'github'; readonly repo: string; readonly number: number }
  | { readonly provider: 'gitlab'; readonly projectPath: string; readonly iid: number }
  | { readonly provider: 'sentry'; readonly shortId: string }
  | { readonly provider: 'sentry-id'; readonly issueId: string };

export type LookupContext = {
  readonly connected: ReadonlySet<LookupProvider>;
  readonly jiraProjectKey: string | null;
  readonly sentryProjects: ReadonlyArray<string>;
  readonly githubRepos: ReadonlyArray<string>;
  readonly gitlabProjects: ReadonlyArray<string>;
};

export type LookupRoute =
  | { readonly kind: 'none' }
  | {
      readonly kind: 'lookup';
      readonly label: string;
      readonly targets: ReadonlyArray<LookupTarget>;
    }
  | {
      readonly kind: 'not-connected';
      readonly label: string;
      readonly providers: ReadonlyArray<LookupProvider>;
    }
  | { readonly kind: 'no-repo'; readonly label: string };

const NONE: LookupRoute = { kind: 'none' };

const notConnected = (
  label: string,
  providers: ReadonlyArray<LookupProvider>,
  context: LookupContext,
): LookupRoute => ({
  kind: 'not-connected',
  label,
  providers: providers.filter((provider) => !context.connected.has(provider)),
});

const routeKey = (
  parsed: Extract<ParsedIssueCode, { kind: 'key' }>,
  context: LookupContext,
): LookupRoute => {
  const { connected } = context;
  const jiraKey = context.jiraProjectKey?.toUpperCase() ?? null;
  if (connected.has('jira') && jiraKey === parsed.prefix) {
    return {
      kind: 'lookup',
      label: parsed.code,
      targets: [{ provider: 'jira', key: parsed.code }],
    };
  }
  const targets: LookupTarget[] = [];
  if (connected.has('linear')) {
    targets.push({ provider: 'linear', identifier: parsed.code });
  }
  if (connected.has('jira')) {
    targets.push({ provider: 'jira', key: parsed.code });
  }
  const isSentryPrefix = context.sentryProjects.some(
    (project) => project.toUpperCase() === parsed.prefix,
  );
  if (connected.has('sentry') && isSentryPrefix) {
    targets.push({ provider: 'sentry', shortId: parsed.code });
  }
  if (targets.length === 0) {
    return notConnected(parsed.code, ['linear', 'jira'], context);
  }
  return { kind: 'lookup', label: parsed.code, targets };
};

export const routeIssueCode = (parsed: ParsedIssueCode, context: LookupContext): LookupRoute => {
  const { connected } = context;
  switch (parsed.kind) {
    case 'text':
      return NONE;
    case 'key':
      return routeKey(parsed, context);
    case 'shortId':
      return connected.has('sentry')
        ? {
            kind: 'lookup',
            label: parsed.code,
            targets: [{ provider: 'sentry', shortId: parsed.code }],
          }
        : NONE;
    case 'number': {
      const label = `#${parsed.number}`;
      const targets: LookupTarget[] = [
        ...(connected.has('github')
          ? context.githubRepos.map((repo) => ({
              provider: 'github' as const,
              repo,
              number: parsed.number,
            }))
          : []),
        ...(connected.has('gitlab')
          ? context.gitlabProjects.map((projectPath) => ({
              provider: 'gitlab' as const,
              projectPath,
              iid: parsed.number,
            }))
          : []),
      ];
      return targets.length === 0 ? { kind: 'no-repo', label } : { kind: 'lookup', label, targets };
    }
    case 'slugNumber': {
      const label = `${parsed.slug}#${parsed.number}`;
      const targets: LookupTarget[] = [];
      if (parsed.host === 'github-or-gitlab' && connected.has('github')) {
        targets.push({ provider: 'github', repo: parsed.slug, number: parsed.number });
      }
      if (connected.has('gitlab')) {
        targets.push({ provider: 'gitlab', projectPath: parsed.slug, iid: parsed.number });
      }
      if (targets.length === 0) {
        return notConnected(
          label,
          parsed.host === 'gitlab' ? ['gitlab'] : ['github', 'gitlab'],
          context,
        );
      }
      return { kind: 'lookup', label, targets };
    }
    case 'url': {
      const { url } = parsed;
      switch (url.provider) {
        case 'linear':
          return connected.has('linear')
            ? {
                kind: 'lookup',
                label: url.identifier,
                targets: [{ provider: 'linear', identifier: url.identifier }],
              }
            : notConnected(url.identifier, ['linear'], context);
        case 'jira':
          return connected.has('jira')
            ? { kind: 'lookup', label: url.key, targets: [{ provider: 'jira', key: url.key }] }
            : notConnected(url.key, ['jira'], context);
        case 'github': {
          const label = `${url.repo}#${url.number}`;
          return connected.has('github')
            ? {
                kind: 'lookup',
                label,
                targets: [{ provider: 'github', repo: url.repo, number: url.number }],
              }
            : notConnected(label, ['github'], context);
        }
        case 'gitlab': {
          const label = `${url.projectPath}#${url.iid}`;
          return connected.has('gitlab')
            ? {
                kind: 'lookup',
                label,
                targets: [{ provider: 'gitlab', projectPath: url.projectPath, iid: url.iid }],
              }
            : notConnected(label, ['gitlab'], context);
        }
        case 'sentry':
          return connected.has('sentry')
            ? {
                kind: 'lookup',
                label: url.issueId,
                targets: [{ provider: 'sentry-id', issueId: url.issueId }],
              }
            : notConnected(url.issueId, ['sentry'], context);
      }
    }
  }
};
