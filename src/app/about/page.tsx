import Link from "next/link";

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-[var(--background)] px-5 pb-16 pt-32 text-[var(--foreground)] sm:px-8">
      <div className="mx-auto max-w-5xl border border-black/10 bg-white/82 p-8 shadow-[0_22px_50px_rgba(20,16,13,0.08)] sm:p-12">
        <p className="font-mono text-[12px] uppercase tracking-[0.28em] text-[var(--muted)]">
          About
        </p>
        <h1 className="mt-4 text-[clamp(2.8rem,6vw,5rem)] font-semibold leading-[0.92] tracking-[-0.05em]">
          Endurance verifies a student application packet instead of acting like a simple file drive.
        </h1>
        <p className="mt-6 max-w-3xl text-lg leading-8 text-[var(--foreground-soft)]">
          This project is built around the study-abroad document workflow. Students upload required
          files, the system checks authenticity signals automatically, and the portal explains what
          is missing, what failed, and what should be fixed before resubmission.
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          <div className="border border-black/10 bg-[var(--panel)] p-5">
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--muted)]">
              What it checks
            </p>
            <p className="mt-3 text-base leading-7 text-[var(--foreground-soft)]">
              File extension, MIME type, size limits, binary signature integrity, duplicate uploads,
              filename hygiene, and document-type intent.
            </p>
          </div>
          <div className="border border-black/10 bg-[var(--panel)] p-5">
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--muted)]">
              What students see
            </p>
            <p className="mt-3 text-base leading-7 text-[var(--foreground-soft)]">
              Clear packet coverage, rejection guidance, duplicate handling, document navigation,
              deletion controls, and live application progress in one portal.
            </p>
          </div>
          <div className="border border-black/10 bg-[var(--panel)] p-5">
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--muted)]">
              Current scope
            </p>
            <p className="mt-3 text-base leading-7 text-[var(--foreground-soft)]">
              The app is currently an MVP focused on proving the core verification and rule-engine
              logic before deeper production hardening.
            </p>
          </div>
        </div>

        <div className="mt-10 flex flex-wrap gap-4">
          <Link
            href="/portal"
            className="inline-flex items-center gap-3 border border-black bg-black px-5 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-white"
            style={{ color: "#ffffff" }}
          >
            Open Portal
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-3 border border-black/10 bg-white px-5 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--foreground)]"
          >
            Return Home
          </Link>
        </div>
      </div>
    </main>
  );
}
