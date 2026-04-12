export default function Home() {
  return (
    <div className="min-h-screen bg-white dark:bg-black flex flex-col items-center justify-center px-6">
      <main className="max-w-xl w-full flex flex-col gap-10">
        {/* Eyebrow */}
        <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
          Anthropic &times; Claude &times; Amsterdam &times; 2026
        </p>

        {/* Headline */}
        <div className="flex flex-col gap-4">
          <h1 className="text-4xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50 leading-tight">
            Something meaningful<br />is coming.
          </h1>
          <p className="text-lg text-zinc-500 dark:text-zinc-400 leading-relaxed">
            We&apos;re building a tool for people who are too often left behind —
            designed with real communities in mind, built in 24 hours at the
            Claude Code Hackathon in Amsterdam.
          </p>
        </div>

        {/* Divider */}
        <div className="h-px w-12 bg-zinc-200 dark:bg-zinc-800" />

        {/* Team */}
        <div className="flex flex-col gap-1">
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
            The team
          </p>
          <p className="text-base text-zinc-700 dark:text-zinc-300 font-medium">
            Ivan &amp; Vivienne
          </p>
        </div>
      </main>
    </div>
  );
}
