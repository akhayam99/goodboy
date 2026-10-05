import { Markdown } from '@goodboy/ui';
import './artifactProse.css';

type Props = {
  readonly text: string;
  readonly hasLead?: boolean;
  readonly measure?: 'reading' | 'full';
};

export const ArtifactProse = ({ text, hasLead = true, measure = 'reading' }: Props) => (
  <div
    data-testid="artifact-prose"
    data-find-root
    data-lead={hasLead ? 'true' : 'false'}
    data-measure={measure}
    className="artifact-prose min-w-0"
  >
    <Markdown text={text} className="text-prose" />
  </div>
);
