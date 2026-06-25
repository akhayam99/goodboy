export function CollapsedSummary({ text }: { readonly text: string }) {
  return <p className="pb-1 pl-2 text-2xs text-muted-foreground/60">{text}</p>
}
