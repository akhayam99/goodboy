import { ShieldCheck } from 'lucide-react';

const TRUST_COPY =
  "Goodboy runs the provider's own sign-in. Your credentials never pass through it.";

export const TrustNote = () => {
  return (
    <p className="flex items-start gap-2 text-2xs leading-relaxed text-muted-foreground">
      <ShieldCheck size={12} aria-hidden className="mt-0.5 shrink-0" />
      <span>{TRUST_COPY}</span>
    </p>
  );
};
