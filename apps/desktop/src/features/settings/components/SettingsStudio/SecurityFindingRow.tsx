import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import type { SecretKind, SecurityFinding, SecurityFindingSubjectKind } from '@goodboy/types';
import { Button, InlineConfirm, Notice, formatError } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { formatRelativeDuration } from '../../../../shared/utils/relativeDate';

export const SECRET_KIND_LABEL: Readonly<Record<SecretKind, string>> = {
  'github-token': 'GitHub token',
  'github-fine-grained-token': 'GitHub token',
  'openai-key': 'OpenAI key',
  'slack-bot-token': 'Slack bot token',
  'slack-user-token': 'Slack user token',
  'linear-api-key': 'Linear API key',
  'gitlab-token': 'GitLab token',
  'aws-access-key': 'AWS access key',
  'private-key': 'Private key',
  jwt: 'JWT',
  'generic-secret': 'Token',
};

const SUBJECT_KIND_LABEL: Readonly<Record<SecurityFindingSubjectKind, string>> = {
  script: 'saved script',
  'workflow-step': 'workflow step',
  profile: 'profile',
  'reply-template': 'reply template',
  'permission-rule': 'permission rule',
};

type ResolvedSubject = {
  readonly name: string;
  readonly projectName: string | null;
};

type ResolveSubjectParams = {
  readonly finding: SecurityFinding;
  readonly projectScripts: ReadonlyArray<{ readonly id: string; readonly name: string }>;
  readonly projectNameById: Readonly<Record<string, string>>;
};

const resolveSubject = ({
  finding,
  projectScripts,
  projectNameById,
}: ResolveSubjectParams): ResolvedSubject | null => {
  if (finding.subjectKind !== 'script') {
    return null;
  }
  const script = projectScripts.find((candidate) => candidate.id === finding.subjectId);
  if (script === undefined) {
    return null;
  }
  const projectName = finding.projectId === undefined ? null : projectNameById[finding.projectId];
  return { name: script.name, projectName: projectName ?? null };
};

type Props = {
  readonly finding: SecurityFinding;
  readonly projectScripts: ReadonlyArray<{ readonly id: string; readonly name: string }>;
  readonly projectNameById: Readonly<Record<string, string>>;
  readonly onNotASecret: (params: { readonly finding: SecurityFinding }) => Promise<void>;
};

export const SecurityFindingRow = ({
  finding,
  projectScripts,
  projectNameById,
  onNotASecret,
}: Props) => {
  const [isConfirming, setIsConfirming] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const resolved = resolveSubject({ finding, projectScripts, projectNameById });
  const label = SUBJECT_KIND_LABEL[finding.subjectKind];
  const title =
    resolved === null
      ? `1 ${label} looks like it contains a token.`
      : `1 ${label} looks like it contains a token: "${resolved.name}"${
          resolved.projectName === null ? '' : ` in ${resolved.projectName}`
        }.`;

  const confirm = async () => {
    setIsBusy(true);
    setError(null);
    try {
      await onNotASecret({ finding });
    } catch (failure) {
      setError(formatError(failure));
    } finally {
      setIsBusy(false);
      setIsConfirming(false);
    }
  };

  return (
    <Notice
      tone="warning"
      placement="inline"
      title={title}
      body={
        <span className="font-mono text-2xs">
          {SECRET_KIND_LABEL[finding.secretKind]} ending ••••{finding.last4}
        </span>
      }
      detail={`${SECRET_KIND_LABEL[finding.secretKind]} · found ${formatRelativeDuration(finding.firstSeenAt)} ago`}
      actions={
        isConfirming ? (
          <InlineConfirm
            role="alert"
            icon={<ShieldCheck size={ICON_SIZE.control} aria-hidden />}
            title="Goodboy stops flagging this exact value."
            confirmLabel="Not a secret"
            isBusy={isBusy}
            onConfirm={() => void confirm()}
            onCancel={() => setIsConfirming(false)}
            surface="plain"
          />
        ) : (
          <Button variant="ghost" size="sm" onClick={() => setIsConfirming(true)}>
            Not a secret
          </Button>
        )
      }
    >
      {error !== null && (
        <p role="alert" className="text-2xs text-danger">
          {error}
        </p>
      )}
    </Notice>
  );
};
