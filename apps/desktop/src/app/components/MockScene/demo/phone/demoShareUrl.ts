import { DEMO_CHAPTERS } from '../demoChapters';
import { PHONE_LINKS } from './phoneLinks';

type Params = {
  readonly hash: string;
};

export const demoShareUrl = ({ hash }: Params): string => {
  const wanted = hash.replace(/^#/, '');
  const chapter = DEMO_CHAPTERS.find((entry) => entry.id === wanted);
  if (chapter === undefined || chapter.id === DEMO_CHAPTERS[0].id) {
    return PHONE_LINKS.demo;
  }
  return `${PHONE_LINKS.demo}#${chapter.id}`;
};
