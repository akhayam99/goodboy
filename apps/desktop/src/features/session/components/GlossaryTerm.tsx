import type { ReactNode } from 'react';
import { TermHint } from '@goodboy/ui';
import { GLOSSARY, type GlossaryTermId } from '../glossary';

type Props = {
  readonly term: GlossaryTermId;
  readonly children: ReactNode;
};

const openGuide = () => window.dispatchEvent(new CustomEvent('goodboy:open-guide'));

export const GlossaryTerm = ({ term, children }: Props) => (
  <TermHint
    term={GLOSSARY[term].term}
    definition={GLOSSARY[term].definition}
    action={{ label: 'Open the guide', onAct: openGuide }}
  >
    {children}
  </TermHint>
);
