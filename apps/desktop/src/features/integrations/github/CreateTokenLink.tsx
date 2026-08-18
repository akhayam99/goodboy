import { ExternalLink } from 'lucide-react';

const TOKEN_CREATE_URL = 'https://github.com/settings/tokens/new?scopes=repo&description=Goodboy';
const TOKEN_LIST_URL = 'https://github.com/settings/tokens';

export const CreateTokenLink = () => {
  return (
    <p className="text-3xs leading-relaxed text-muted-foreground">
      <a
        href={TOKEN_CREATE_URL}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 underline underline-offset-2 hover:text-foreground"
      >
        Create a personal access token on GitHub <ExternalLink size={10} aria-hidden />
      </a>{' '}
      (scope <code className="rounded bg-muted px-1 py-0.5 font-mono">repo</code>), then{' '}
      <a
        href={TOKEN_LIST_URL}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 underline underline-offset-2 hover:text-foreground"
      >
        Configure SSO <ExternalLink size={10} aria-hidden />
      </a>{' '}
      if your org requires it.
    </p>
  );
};
