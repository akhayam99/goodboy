import { getSecret } from './secrets';

export interface IssueData {
  readonly title: string;
  readonly body: string;
  readonly url: string;
  readonly service: 'github' | 'gitlab' | 'jira' | 'linear';
}

// ─── Linear ────────────────────────────────────────────────────────────────────

export function parseLinearIssueUrl(input: string): string | null {
  const trimmed = input.trim();
  const urlMatch = trimmed.match(/linear\.app\/[^/]+\/issue\/([A-Z]+-\d+)/i);
  if (urlMatch) return urlMatch[1]!.toUpperCase();
  return null;
}

export async function fetchLinearIssue(issueId: string): Promise<IssueData> {
  const token = await getSecret('integration.linear.token');
  if (!token)
    throw new Error('Linear not connected — add your API key in Settings → Integrations.');

  const query = `{ issue(id: "${issueId}") { title description url } }`;
  const res = await fetch('https://api.linear.app/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: token,
    },
    body: JSON.stringify({ query }),
  });

  if (!res.ok) throw new Error(`Linear API error: ${res.status} ${res.statusText}`);

  const json = (await res.json()) as {
    data?: { issue?: { title: string; description?: string | null; url: string } };
    errors?: ReadonlyArray<{ message: string }>;
  };
  if (json.errors?.length) throw new Error(`Linear: ${json.errors[0]!.message}`);

  const issue = json.data?.issue;
  if (!issue) throw new Error(`Linear issue ${issueId} not found.`);

  return {
    service: 'linear',
    title: issue.title,
    body: issue.description ?? '',
    url: issue.url,
  };
}

// ─── GitLab ────────────────────────────────────────────────────────────────────

export function parseGitLabIssueUrl(input: string): { projectPath: string; iid: number } | null {
  const trimmed = input.trim();
  const match = trimmed.match(/gitlab\.com\/(.+?)\/-\/issues\/(\d+)/);
  if (match) return { projectPath: match[1]!, iid: parseInt(match[2]!, 10) };
  return null;
}

export async function fetchGitLabIssue(projectPath: string, iid: number): Promise<IssueData> {
  const token = await getSecret('integration.gitlab.token');
  if (!token) throw new Error('GitLab not connected — add your token in Settings → Integrations.');

  const encoded = encodeURIComponent(projectPath);
  const res = await fetch(`https://gitlab.com/api/v4/projects/${encoded}/issues/${iid}`, {
    headers: { 'PRIVATE-TOKEN': token },
  });

  if (!res.ok) throw new Error(`GitLab API error: ${res.status} ${res.statusText}`);

  const issue = (await res.json()) as {
    title: string;
    description?: string | null;
    web_url: string;
  };

  return {
    service: 'gitlab',
    title: issue.title,
    body: issue.description ?? '',
    url: issue.web_url,
  };
}

// ─── Jira ──────────────────────────────────────────────────────────────────────

export function parseJiraIssueUrl(input: string): string | null {
  const trimmed = input.trim();
  const urlMatch = trimmed.match(/atlassian\.net\/browse\/([A-Z]+-\d+)/i);
  if (urlMatch) return urlMatch[1]!.toUpperCase();
  return null;
}

export async function fetchJiraIssue(issueKey: string): Promise<IssueData> {
  const [token, email, domain] = await Promise.all([
    getSecret('integration.jira.token'),
    getSecret('integration.jira.email'),
    getSecret('integration.jira.domain'),
  ]);
  if (!token || !email || !domain)
    throw new Error('Jira not connected — add your credentials in Settings → Integrations.');

  const auth = btoa(`${email}:${token}`);
  const res = await fetch(`https://${domain}/rest/api/3/issue/${issueKey}`, {
    headers: {
      Authorization: `Basic ${auth}`,
      Accept: 'application/json',
    },
  });

  if (!res.ok) throw new Error(`Jira API error: ${res.status} ${res.statusText}`);

  const issue = (await res.json()) as {
    key: string;
    fields: {
      summary: string;
      description?: JiraDocNode | string | null;
    };
  };

  return {
    service: 'jira',
    title: issue.fields.summary,
    body: extractJiraDocText(issue.fields.description),
    url: `https://${domain}/browse/${issueKey}`,
  };
}

interface JiraDocNode {
  type?: string;
  text?: string;
  content?: JiraDocNode[];
}

function extractJiraDocText(doc: JiraDocNode | string | null | undefined): string {
  if (!doc) return '';
  if (typeof doc === 'string') return doc;
  const parts: string[] = [];
  const walk = (node: JiraDocNode) => {
    if (node.text) parts.push(node.text);
    for (const child of node.content ?? []) walk(child);
  };
  walk(doc);
  return parts.join(' ').trim();
}

// ─── unified detector ──────────────────────────────────────────────────────────

export async function fetchIssueFromUrl(input: string): Promise<IssueData | null> {
  const linear = parseLinearIssueUrl(input);
  if (linear) return fetchLinearIssue(linear);

  const gitlab = parseGitLabIssueUrl(input);
  if (gitlab) return fetchGitLabIssue(gitlab.projectPath, gitlab.iid);

  const jira = parseJiraIssueUrl(input);
  if (jira) return fetchJiraIssue(jira);

  return null;
}
