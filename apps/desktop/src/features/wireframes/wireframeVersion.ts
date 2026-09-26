export type WireframeVersionAuthor = 'agent' | 'user' | 'import' | 'restore';

export type WireframeVersion = Readonly<{
  revision: number;
  title: string;
  sourceText: string;
  author: WireframeVersionAuthor;
  ask: string | null;
  createdAt: string;
  summary: Readonly<Record<string, number>> | null;
}>;

export const wireframeVersionFolder = ({ revision }: { readonly revision: number }): string =>
  `v${revision}`;

export const wireframeVersionLabel = ({
  version,
}: {
  readonly version: WireframeVersion;
}): string => {
  if (version.ask !== null && version.ask.trim().length > 0) {
    return version.ask;
  }
  switch (version.author) {
    case 'import':
      return 'Imported JSON';
    case 'restore':
      return 'Restored version';
    case 'user':
      return 'Edited by hand';
    case 'agent':
      return version.revision === 1 ? 'First draft' : 'Revised by the agent';
    default: {
      const exhaustive: never = version.author;
      return exhaustive;
    }
  }
};

export const wireframeVersionAuthor = ({
  version,
  agentName,
}: {
  readonly version: WireframeVersion;
  readonly agentName: string;
}): string => (version.author === 'agent' && version.ask === null ? agentName : 'You');
