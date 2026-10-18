import Checker from "@/components/Checker";
import { JURISDICTIONS, LAST_REVIEWED } from "@/lib/jurisdictions";

const reviewed = new Date(`${LAST_REVIEWED}T12:00:00`).toLocaleDateString("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});
const lawCount = JURISDICTIONS.filter((j) => j.kind === "posting").length;

function Logo() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden className="shrink-0">
      <rect x="1" y="1" width="20" height="20" rx="6" fill="var(--accent)" />
      <path d="M6.5 11.5l3 3 6-7" fill="none" stroke="var(--accent-ink)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function Home() {
  return (
    <>
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between px-4 sm:px-6">
          <span className="flex items-center gap-2 font-semibold tracking-tight">
            <Logo />
            PayClear
          </span>
          <p className="text-xs text-ink-3">
            <span className="hidden sm:inline">{lawCount} state and city laws · </span>Rules updated {reviewed}
          </p>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-16 pt-8 sm:px-6 sm:pt-12">
        <div className="mb-8 max-w-2xl">
          <h1 className="text-3xl font-semibold leading-[1.1] tracking-[-0.02em] sm:text-[2.6rem]">
            Check a job posting against every pay-transparency law it reaches.
          </h1>
          <p className="mt-3 text-base text-ink-2 sm:text-lg">
            Paste the posting. See what&apos;s missing in each state and city, why it matters, and a fixed version you can copy.
          </p>
        </div>

        <Checker />
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto w-full max-w-7xl px-4 py-6 text-xs leading-relaxed text-ink-3 sm:px-6">
          Not legal advice. PayClear summarizes laws in simplified form and links the source for each rule. Confirm with
          the source or counsel before relying on a result.
        </div>
      </footer>
    </>
  );
}
