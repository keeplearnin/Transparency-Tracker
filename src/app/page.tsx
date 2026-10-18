import Checker from "@/components/Checker";
import { LAST_REVIEWED } from "@/lib/jurisdictions";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6 sm:py-14">
      <header className="mb-10 max-w-3xl">
        <p className="mb-3 text-sm font-medium tracking-wide text-accent uppercase">PayClear</p>
        <h1 className="font-serif text-4xl leading-tight sm:text-5xl">
          Is this job posting legal everywhere it reaches?
        </h1>
        <p className="mt-4 text-lg text-muted">
          Paste a job posting. We check it against US state and city pay-transparency laws, flag what&apos;s
          missing, and point to the source for every rule. Then let Claude draft a fixed version. Free and no sign-up;
          the quick check runs entirely in your browser.
        </p>
      </header>

      <Checker />

      <footer className="mt-16 border-t border-line pt-6 text-sm text-muted">
        <p>
          <strong className="font-medium text-ink">Not legal advice.</strong> PayClear is an automated checker with
          simplified rule summaries. Rules last reviewed {LAST_REVIEWED}. Always confirm against the linked source or
          with counsel before relying on a result.
        </p>
      </footer>
    </main>
  );
}
