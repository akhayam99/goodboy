import { Eyebrow } from '../components/ui';

/* A founder note. Marketing-side editorial centerpiece. Serif body, generous
   leading, prose width. The only place on the site where the voice is "I"
   instead of "the tool". Kept short on purpose. */
export function Letter() {
  return (
    <section id="note" className="relative py-28 sm:py-36">
      <div className="mx-auto max-w-2xl px-6">
        <Eyebrow>A note from the author</Eyebrow>

        <div className="letter mt-10 space-y-6 text-[19px] text-foreground/90">
          <p>
            Not too long ago, I had three chats open. Claude for plans. Cursor for edits. Codex for
            scaffolding. Each one knew a piece of the work. None had the full picture.
          </p>
          <p>
            I would ship something half-built, then re-paste the goal into the next window because
            the model reviewing it had no idea what we&apos;d decided. By evening, I spent more time
            re-explaining myself than building.
          </p>
          <p>
            Goodboy is the tool I needed in that moment and couldn&apos;t find. It sits above all
            providers, not in their place. The context lives outside the chat, so the next agent
            shows up already briefed. Costs update in real time next to your work. The PR lands
            where I&apos;m already looking.
          </p>
          <p>
            It is open source because tools you trust in your terminal should be yours to read. It
            is local-first because what runs on your machine stays there. It is opinionated where it
            has to be, and quiet everywhere else.
          </p>
          <p>
            If you&apos;ve felt the same, clone it. Tell me what&apos;s broken. We&apos;ll fix it
            together.
          </p>
        </div>

        <div className="mt-10 flex items-center justify-end gap-4 text-right text-[14px] text-muted-foreground">
          <div className="space-y-0.5">
            <p className="font-serif text-[18px] text-foreground">Amin Khayam</p>
            <p className="text-[12px] tracking-[0.02em]">Milan, 2026</p>
          </div>
          <div className="h-px w-10 bg-border-soft" />
        </div>
      </div>
    </section>
  );
}
