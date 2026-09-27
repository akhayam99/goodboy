import { Button, Notice } from '@goodboy/ui';
import type { LeftOutFinding } from '@goodboy/types';
import { SECRET_KIND_LABEL } from '../../../settings/components/SettingsStudio/SecurityFindingRow';

type Props = {
  readonly findings: ReadonlyArray<LeftOutFinding>;
  readonly leaveOut: ReadonlyArray<string>;
  readonly onChange: (params: { readonly fingerprint: string; readonly included: boolean }) => void;
};

export const LeftOutFindings = ({ findings, leaveOut, onChange }: Props) => {
  if (findings.length === 0) {
    return null;
  }
  return (
    <Notice
      tone="warning"
      placement="inline"
      title={`${findings.length} security ${findings.length === 1 ? 'finding is' : 'findings are'} left out of the export.`}
      body={
        <ul className="flex flex-col gap-1.5">
          {findings.map((finding) => {
            const isLeftOut = leaveOut.includes(finding.fingerprint);
            return (
              <li
                key={finding.fingerprint}
                className="flex items-center justify-between gap-2 text-label"
              >
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="font-mono text-foreground">{finding.subjectId}</span>
                  <span className="text-secondary text-muted-foreground">
                    {SECRET_KIND_LABEL[finding.secretKind as keyof typeof SECRET_KIND_LABEL] ??
                      'Token'}{' '}
                    ending ••••{finding.last4}
                  </span>
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    onChange({ fingerprint: finding.fingerprint, included: isLeftOut })
                  }
                >
                  {isLeftOut ? 'Include it' : 'Leave it out'}
                </Button>
              </li>
            );
          })}
        </ul>
      }
    />
  );
};
