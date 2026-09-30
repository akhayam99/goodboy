type Props = { readonly sha: string };

export const ThreadGitSha = ({ sha }: Props) => (
  <code className="rounded-sm bg-hover px-1 font-mono text-code text-foreground">
    {sha.slice(0, 7)}
  </code>
);
