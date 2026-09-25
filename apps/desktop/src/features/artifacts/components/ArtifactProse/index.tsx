import { Markdown } from '@goodboy/ui';
import './artifactProse.css';

type Props = {
  readonly text: string;
  readonly hasLead?: boolean;
};

export const ArtifactProse = ({ text, hasLead = true }: Props) => (
  <div
    data-testid="artifact-prose"
    data-lead={hasLead ? 'true' : 'false'}
    className="artifact-prose min-w-0"
  >
    <Markdown text={text} className="text-base leading-6" />
  </div>
);
