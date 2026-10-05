import { TreeFrame } from './TreeFrame';

type Props = {
  readonly title: string;
  readonly description: string;
};

export const TreeEmpty = ({ title, description }: Props) => (
  <TreeFrame heading="0 files">
    <div className="flex flex-col items-center gap-1 pt-10 text-center">
      <p className="text-row text-foreground">{title}</p>
      <p className="text-meta text-muted-foreground">{description}</p>
    </div>
  </TreeFrame>
);
