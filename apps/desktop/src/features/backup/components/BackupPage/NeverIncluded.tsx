const NEVER_INCLUDED: ReadonlyArray<string> = [
  'API keys and tokens',
  'Sign-ins for providers and tools',
  'Sessions, chats and transcripts',
  'Reports, wireframes and other artifacts',
  'Worktree folders',
  'Usage and spend history',
  'Notifications',
];

export const NeverIncluded = () => (
  <div className="flex flex-col gap-2 rounded-md bg-muted p-3">
    <span className="text-row text-foreground">Never included</span>
    <ul className="flex flex-col gap-0.5 text-label text-muted-foreground">
      {NEVER_INCLUDED.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  </div>
);
