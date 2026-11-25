import type { Guide } from './Guide';

type Props = {
  readonly guides: readonly Guide[];
};

export const GuideLinkList = ({ guides }: Props) => (
  <ul className="guideList">
    {guides.map((guide) => (
      <li key={guide.path}>
        <a href={guide.path}>{guide.title}</a>
        <span>{guide.summary}</span>
      </li>
    ))}
  </ul>
);
