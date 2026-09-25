import { Markdown } from '@goodboy/ui';
import './artifactProse.css';

type Props = {
  readonly text: string;
};

export const ArtifactProse = ({ text }: Props) => (
  <div data-testid="artifact-prose" className="artifact-prose min-w-0">
    <Markdown text={text} className="text-base leading-6" />
  </div>
);
