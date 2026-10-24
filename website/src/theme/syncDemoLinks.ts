import { SITE } from '../site';
import { currentTheme } from './theme';

const EVENTS = ['click', 'auxclick', 'contextmenu', 'focusin'] as const;

const isDemoHref = (href: string): boolean => {
  try {
    return new URL(href).origin === new URL(SITE.demo).origin;
  } catch {
    return false;
  }
};

const onLinkEvent = (event: Event): void => {
  if (!(event.target instanceof Element)) {
    return;
  }
  const anchor = event.target.closest('a');
  if (anchor === null || !isDemoHref(anchor.href)) {
    return;
  }
  const url = new URL(anchor.href);
  url.searchParams.set('theme', currentTheme());
  anchor.href = url.toString();
};

export const syncDemoLinks = (): void => {
  for (const type of EVENTS) {
    document.addEventListener(type, onLinkEvent, { capture: true });
  }
};
