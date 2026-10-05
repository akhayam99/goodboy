export type Crumb = {
  readonly name: string;
  readonly path: string;
};

type Props = {
  readonly crumbs: readonly Crumb[];
};

export const Breadcrumbs = ({ crumbs }: Props) => (
  <nav className="crumbs" aria-label="Breadcrumb">
    <ol>
      {crumbs.map((crumb, index) =>
        index === crumbs.length - 1 ? (
          <li key={crumb.path} aria-current="page">
            {crumb.name}
          </li>
        ) : (
          <li key={crumb.path}>
            <a href={crumb.path}>{crumb.name}</a>
          </li>
        ),
      )}
    </ol>
  </nav>
);
