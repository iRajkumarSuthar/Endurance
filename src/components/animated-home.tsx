"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { PlusBurstNav } from "@/components/plus-burst-nav";

const reveal = {
  hidden: { opacity: 0, y: 28 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] as const },
  },
};

const requiredDocuments = [
  {
    index: "/01",
    label: "Identity document",
    title: "Passport",
    displayTitle: "Passport",
    description:
      "Upload the identity page used to confirm travel identity and unlock the rest of the application packet.",
    accepted: "PDF, JPG, PNG",
    action: "Add Passport",
  },
  {
    index: "/02",
    label: "Academic record",
    title: "Academic Transcript",
    displayTitle: "Transcript",
    description:
      "Submit official academic records so advisors and reviewers can evaluate grade history and program readiness.",
    accepted: "PDF",
    action: "Add Transcript",
  },
  {
    index: "/03",
    label: "Financial proof",
    title: "Bank Statement",
    displayTitle: "Bank Statement",
    description:
      "Provide recent banking proof to support tuition, living-cost, and visa-readiness evaluation for the destination.",
    accepted: "PDF, JPG, PNG",
    action: "Add Statement",
  },
  {
    index: "/04",
    label: "Applicant narrative",
    title: "Statement of Purpose",
    displayTitle: "Purpose",
    description:
      "Add the personal statement that explains academic intent, destination choice, and the reason for applying abroad.",
    accepted: "PDF, DOC export",
    action: "Add SOP",
  },
  {
    index: "/05",
    label: "Profile document",
    title: "Resume / CV",
    displayTitle: "Resume",
    description:
      "Include the applicant profile with education, experience, and achievements that support the chosen study path.",
    accepted: "PDF",
    action: "Add Resume",
  },
  {
    index: "/06",
    label: "Language readiness",
    title: "English Test Score",
    displayTitle: "Score",
    description:
      "Upload IELTS, TOEFL, or equivalent results so the application can show language readiness in the live packet.",
    accepted: "PDF, JPG, PNG",
    action: "Add Score",
  },
];

const studyAbroadVideo =
  "https://www.youtube.com/embed/RCo0EHLqTVI?autoplay=1&mute=1&controls=0&loop=1&playlist=RCo0EHLqTVI&playsinline=1&rel=0&modestbranding=1";

export function AnimatedHome() {
  return (
    <main className="bg-[var(--background)] text-[var(--foreground)]">
      <section className="relative overflow-hidden border-b border-black/10 bg-black">
        <div className="absolute inset-0">
          <iframe
            src={studyAbroadVideo}
            title="Study abroad campus life"
            allow="autoplay; encrypted-media; picture-in-picture"
            className="pointer-events-none absolute inset-0 h-full w-full scale-[1.55] object-cover opacity-100"
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,10,14,0.48)_0%,rgba(8,10,14,0.44)_18%,rgba(8,10,14,0.54)_42%,rgba(8,10,14,0.7)_70%,rgba(8,10,14,0.88)_100%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.06),transparent_16%),linear-gradient(90deg,rgba(0,0,0,0.3)_0%,rgba(0,0,0,0.14)_42%,rgba(0,0,0,0.32)_100%)]" />
        </div>

        <div className="relative mx-auto flex min-h-screen w-full max-w-[1800px] flex-col px-5 pb-10 pt-5 text-white sm:px-8 sm:pb-14 sm:pt-6">
          <div className="flex items-center justify-between border-b border-white/14 px-1 pb-2 sm:px-2">
            <Link href="/" aria-label="Endurance Home" className="inline-flex items-center">
              <Image
                src="/logo.svg"
                alt="Endurance logo"
                width={240}
                height={72}
                className="h-[clamp(1.9rem,3.6vw,3.3rem)] w-auto"
                priority
              />
            </Link>
            <PlusBurstNav buttonClassName="h-[40px] w-[40px] sm:h-[46px] sm:w-[46px]" />
          </div>

          <div className="flex flex-1 items-start justify-center pt-1 sm:pt-2">
            <motion.div
              initial={{ opacity: 0, y: 26 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
              className="w-full"
            >
              <h1 className="text-center text-[clamp(6rem,18vw,17rem)] font-semibold uppercase leading-[0.85] tracking-[-0.085em] text-white/56 drop-shadow-[0_10px_28px_rgba(0,0,0,0.28)]">
                Endurance
              </h1>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="bg-white px-5 py-16 sm:px-8 sm:py-20">
        <div className="mx-auto max-w-[1600px]">
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.2 }}
            variants={reveal}
            className="max-w-5xl"
          >
            <p className="font-mono text-[12px] uppercase tracking-[0.28em] text-[var(--muted)]">
              Required Documents
            </p>
            <h2 className="mt-6 text-[clamp(2.8rem,6vw,5.8rem)] font-medium leading-[0.96] tracking-[-0.07em] text-[#323543]">
              Every required upload lives in one visible study-abroad packet.
            </h2>
          </motion.div>

          <div className="mt-10 space-y-5">
            {requiredDocuments.map((document, index) => (
              <motion.article
                key={document.index}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.18 }}
                transition={{ duration: 0.68, ease: [0.22, 1, 0.36, 1], delay: index * 0.06 }}
                className="grid gap-6 border border-black/8 bg-[#f7f5f0] p-6 sm:p-8 lg:grid-cols-[0.28fr_0.28fr_0.44fr] lg:items-center"
              >
                <div className="max-w-sm">
                  <p className="font-mono text-[12px] uppercase tracking-[0.22em] text-[var(--accent)]">
                    {document.index}
                  </p>
                  <p className="mt-5 text-sm uppercase tracking-[0.18em] text-[var(--muted)]">
                    {document.label}
                  </p>
                  <h3 className="mt-3 text-[2rem] font-medium tracking-[-0.05em] text-[var(--foreground)]">
                    {document.title}
                  </h3>
                  <p className="mt-4 text-base leading-7 text-[var(--foreground-soft)]">
                    {document.description}
                  </p>
                </div>

                <div className="border border-black/10 bg-white p-5 shadow-[0_14px_36px_rgba(20,16,13,0.06)]">
                  <div className="flex items-center justify-between gap-3 border-b border-black/8 pb-3">
                    <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--muted)]">
                      File Action
                    </p>
                    <span className="border border-[var(--accent)]/30 bg-[rgba(232,109,31,0.08)] px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-[var(--accent)]">
                      Required
                    </span>
                  </div>
                  <div className="mt-4 space-y-3 text-sm text-[var(--foreground-soft)]">
                    <p>Accepted: {document.accepted}</p>
                    <p>Verification begins after upload in the live portal.</p>
                  </div>
                  <Link
                    href="/portal"
                    className="mt-6 inline-flex items-center justify-center border border-[var(--foreground)] bg-[var(--foreground)] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--background)] transition hover:opacity-92"
                  >
                    {document.action}
                  </Link>
                </div>

                <div className="overflow-hidden">
                  <p className="text-left text-[clamp(3.6rem,8vw,8rem)] font-medium leading-[0.88] tracking-[-0.08em] text-[#1e2230] lg:text-right">
                    {document.displayTitle}
                  </p>
                </div>
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white px-5 py-18 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-[1600px]">
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.2 }}
            variants={reveal}
            className="mx-auto max-w-[1400px] text-center"
          >
            <p className="font-mono text-[12px] uppercase tracking-[0.28em] text-[var(--muted)]">
              Endurance Platform
            </p>
            <h2 className="mt-8 text-[clamp(2.8rem,6vw,6.6rem)] font-medium leading-[0.98] tracking-[-0.07em] text-[#3f4350]">
              Endurance keeps passports, transcripts, financial proof, personal statements,
              resumes, and English scores visible from first upload to review-ready submission.
            </h2>
          </motion.div>
        </div>
      </section>

      <footer className="px-5 py-18 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-[1500px] border border-black/10 bg-white/82 p-8 shadow-[0_22px_50px_rgba(20,16,13,0.08)] sm:p-10">
          <div className="flex flex-wrap items-end justify-between gap-8">
            <div className="max-w-3xl">
              <p className="font-mono text-[12px] uppercase tracking-[0.28em] text-[var(--muted)]">
                Launch State
              </p>
              <h2 className="mt-4 text-[clamp(2.4rem,5vw,4.5rem)] font-semibold leading-[0.95] tracking-[-0.05em]">
                Open the portal and run the verification flow end to end.
              </h2>
            </div>
            <Link
              href="/portal"
              className="group inline-flex items-center gap-4 border border-[var(--foreground)] bg-[var(--foreground)] px-6 py-4 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--background)]"
            >
              Start Uploading
              <span className="transition-transform duration-300 group-hover:translate-x-1">/</span>
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
