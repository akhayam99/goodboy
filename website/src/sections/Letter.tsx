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
            A year ago I had three chats open. Claude for plans. Cursor for edits I trusted. Codex
            when I needed a scaffold. Each one knew a slice of the work. None knew the whole.
          </p>
          <p>
            I would ship something half-built, then re-paste the goal into the next window because
            the model that should review it had no idea what we&apos;d decided. By evening I had
            spent more time re-explaining than building.
          </p>
          <p>
            Goodboy is the tool I wanted that week and couldn&apos;t find. It sits above the
            providers, not in place of them. The context lives outside the chat, so the next agent
            arrives already briefed. The cost ticks live next to the work. The PR shows up where
            I&apos;m already looking.
          </p>
          <p>
            It is open source because tools you trust to type into your terminal should be yours to
            read. It is local-first because what runs on your machine stays there. It is opinionated
            where it had to be, and quiet everywhere else.
          </p>
          <p>
            If you&apos;ve felt the same thing this year, clone it. Tell me what&apos;s broken.
            We&apos;ll fix it together.
          </p>
        </div>

        <div className="mt-10 flex items-center gap-4 text-[14px] text-muted-foreground">
          <div className="h-px w-10 bg-border-soft" />
          <div className="space-y-0.5">
            <p className="font-serif text-[18px] text-foreground">Amin Khayam</p>
            <p className="text-[12px] tracking-[0.02em]">Milan, 2026</p>
          </div>
        </div>
      </div>
    </section>
  );
}
