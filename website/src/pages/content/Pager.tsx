export type PagerLink = {
  readonly label: string;
  readonly title: string;
  readonly href: string;
};

type Props = {
  readonly label: string;
  readonly links: readonly PagerLink[];
};

export const Pager = ({ label, links }: Props) =>
  links.length === 0 ? null : (
    <nav className="cpPager" aria-label={label}>
      {links.map((link) => (
        <a key={link.href} className="cpPagerLink" href={link.href}>
          <span className="cpPagerLabel">{link.label}</span>
          <span className="cpPagerTitle">{link.title}</span>
        </a>
      ))}
    </nav>
  );
