import { Button } from '@goodboy/ui';

export const AgentMuchLonger = () => (
  <p
    data-testid="agent-much-longer"
    className="flex flex-wrap items-center gap-1 text-meta text-muted-foreground"
  >
    <span>Much longer than usual.</span>
    <Button
      variant="ghost"
      size="xs"
      onClick={() => window.dispatchEvent(new CustomEvent('goodboy:reveal-chat'))}
    >
      Check what it is doing in the transcript
    </Button>
  </p>
);
