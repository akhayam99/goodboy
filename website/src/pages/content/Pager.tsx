export type PagerLink = {
  readonly label: string;
  readonly title: string;
  readonly href: string;
  readonly direction: 'back' | 'forward';
};

type Props = {
  readonly label: string;
  readonly links: readonly PagerLink[];
};

const Arrow = ({ direction }: Pick<PagerLink, 'direction'>) => (
  <svg
    className="cpPagerArrow"
    viewBox="0 0 16 16"
    width="16"
    height="16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {direction === 'back' ? <path d="M13 8H3m4-4L3 8l4 4" /> : <path d="M3 8h10m-4-4 4 4-4 4" />}
  </svg>
);

export const Pager = ({ label, links }: Props) =>
  links.length === 0 ? null : (
    <nav className="cpPager" aria-label={label}>
      {links.map((link) => (
        <a key={link.href} className="cpPagerLink" data-direction={link.direction} href={link.href}>
          <span className="cpPagerLabel">
            {link.direction === 'back' ? <Arrow direction="back" /> : null}
            {link.label}
            {link.direction === 'forward' ? <Arrow direction="forward" /> : null}
          </span>
          <span className="cpPagerTitle">{link.title}</span>
        </a>
      ))}
    </nav>
  );
