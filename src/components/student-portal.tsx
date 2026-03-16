"use client";

import { useDeferredValue, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import {
  deleteUploadedDocument,
  enqueueUpload,
  getApplicationState,
  resetApplicationPacket,
} from "@/lib/student-application-service";
import {
  documentTypeLabels,
  requiredDocumentTypes,
  type ApplicationState,
  type CheckStatus,
  type DocumentType,
  type UploadedDocument,
} from "@/lib/student-application-schema";

const panelReveal = {
  hidden: { opacity: 0, y: 24 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] as const },
  },
};

function formatBytes(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Pending";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function summarizeChecks(document: UploadedDocument) {
  return document.checks.reduce(
    (acc, check) => {
      acc[check.status] += 1;
      return acc;
    },
    { pass: 0, warn: 0, fail: 0 } as Record<CheckStatus, number>
  );
}

function getRequirementStatus(documentType: DocumentType, documents: UploadedDocument[]) {
  const matching = documents.filter((document) => document.documentType === documentType);

  if (matching.some((document) => document.status === "verified")) {
    return "verified";
  }

  if (matching.some((document) => document.status === "verifying")) {
    return "verifying";
  }

  if (matching.some((document) => document.status === "rejected")) {
    return "rejected";
  }

  return "missing";
}

async function loadState() {
  return getApplicationState();
}

export function StudentPortal() {
  const [state, setState] = useState<ApplicationState>({
    applicationId: "APP-STUDENT-0001",
    progressPercent: 0,
    requiredDocuments: [...requiredDocumentTypes],
    missingDocuments: [...requiredDocumentTypes],
    uploadedDocuments: [],
    alerts: [],
    updatedAt: new Date().toISOString(),
  });
  const [selectedType, setSelectedType] = useState<DocumentType>("passport");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deletingDocumentId, setDeletingDocumentId] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const errorTimeoutRef = useRef<number | null>(null);
  const deferredDocuments = useDeferredValue(state.uploadedDocuments);

  function clearScheduledError() {
    if (errorTimeoutRef.current !== null) {
      window.clearTimeout(errorTimeoutRef.current);
      errorTimeoutRef.current = null;
    }
  }

  function showError(message: string, durationMs = 6000) {
    setError(message);
    clearScheduledError();
    errorTimeoutRef.current = window.setTimeout(() => {
      setError("");
      errorTimeoutRef.current = null;
    }, durationMs);
  }

  useEffect(() => {
    let disposed = false;

    const refresh = async () => {
      try {
        const nextState = await loadState();
        if (disposed) {
          return;
        }

        setState(nextState);
        setReady(true);
      } catch (submissionError) {
        if (disposed) {
          return;
        }

        showError(
          submissionError instanceof Error ? submissionError.message : "Unable to refresh application state."
        );
      }
    };

    refresh();

    const intervalId = window.setInterval(() => {
      void refresh();
    }, 1200);

    return () => {
      disposed = true;
      window.clearInterval(intervalId);
      clearScheduledError();
    };
  }, []);

  useEffect(() => {
    if (deferredDocuments.length === 0) {
      setActiveDocumentId(null);
      return;
    }

    if (!activeDocumentId || !deferredDocuments.some((document) => document.id === activeDocumentId)) {
      setActiveDocumentId(deferredDocuments[0].id);
    }
  }, [activeDocumentId, deferredDocuments]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearScheduledError();
    setError("");

    if (!selectedFile) {
      showError("Choose a file before submitting.");
      return;
    }

    setSubmitting(true);

    try {
      await enqueueUpload(selectedType, selectedFile);
      setState(await loadState());
      setError("");

      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (submissionError) {
      showError(
        submissionError instanceof Error ? submissionError.message : "Unexpected upload failure."
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResetApplication() {
    if (state.uploadedDocuments.length === 0 || resetting || submitting) {
      return;
    }

    const confirmed = window.confirm(
      "Reset the application packet and remove all uploaded documents so you can upload them again?"
    );
    if (!confirmed) {
      return;
    }

    setResetting(true);

    try {
      const nextState = await resetApplicationPacket();
      setState(nextState);
      setSelectedFile(null);
      setError("");

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (submissionError) {
      showError(
        submissionError instanceof Error
          ? submissionError.message
          : "Unable to reset the application packet."
      );
    } finally {
      setResetting(false);
    }
  }

  async function handleDeleteDocument(documentId: string, fileName: string) {
    if (submitting || resetting || deletingDocumentId) {
      return;
    }

    const confirmed = window.confirm(`Delete ${fileName} from this application packet?`);
    if (!confirmed) {
      return;
    }

    setDeletingDocumentId(documentId);
    setError("");

    try {
      setState(await deleteUploadedDocument(documentId));
    } catch (submissionError) {
      showError(
        submissionError instanceof Error ? submissionError.message : "Unable to delete this uploaded document."
      );
    } finally {
      setDeletingDocumentId(null);
    }
  }

  const hasPendingChecks = state.uploadedDocuments.some((document) => document.status === "verifying");
  const verifiedCount = requiredDocumentTypes.length - state.missingDocuments.length;
  const activeDocumentIndex = deferredDocuments.findIndex((document) => document.id === activeDocumentId);
  const resolvedDocumentIndex = activeDocumentIndex >= 0 ? activeDocumentIndex : 0;
  const activeDocument = deferredDocuments[resolvedDocumentIndex];

  function showPreviousDocument() {
    if (deferredDocuments.length < 2 || !activeDocument) {
      return;
    }

    const nextIndex =
      resolvedDocumentIndex === 0 ? deferredDocuments.length - 1 : resolvedDocumentIndex - 1;
    setActiveDocumentId(deferredDocuments[nextIndex].id);
  }

  function showNextDocument() {
    if (deferredDocuments.length < 2 || !activeDocument) {
      return;
    }

    const nextIndex =
      resolvedDocumentIndex === deferredDocuments.length - 1 ? 0 : resolvedDocumentIndex + 1;
    setActiveDocumentId(deferredDocuments[nextIndex].id);
  }

  return (
    <main className="min-h-screen bg-white text-[var(--foreground)]">
      <section className="border-b border-black/10 bg-white">
        <div className="relative mx-auto max-w-[1500px] px-5 pb-16 pt-32 sm:px-8 sm:pb-20">
          <motion.div
            initial="hidden"
            animate="show"
            variants={panelReveal}
            className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]"
          >
            <div>
              <p className="font-mono text-[12px] uppercase tracking-[0.28em] text-[var(--muted)]">
                Student Application Ops
              </p>
              <h1 className="mt-4 max-w-4xl text-[clamp(3rem,7vw,6.4rem)] font-semibold leading-[0.9] tracking-[-0.05em]">
                Automated document verification with live missing-file logic.
              </h1>
              <p className="mt-6 max-w-3xl text-lg leading-8 text-[var(--foreground-soft)] sm:text-xl">
                This portal implements the PDF brief directly: students upload study-abroad
                documents, the system runs authenticity checks automatically, and the application
                status updates in real time when required files are missing or rejected.
              </p>

              <div className="mt-10 flex flex-wrap gap-4">
                <Link
                  href="/"
                  className="inline-flex items-center gap-3 border border-black bg-black px-5 py-3 text-sm font-semibold uppercase tracking-[0.16em] text-white transition hover:bg-black/90"
                  style={{ color: "#ffffff" }}
                >
                  Return Home
                </Link>
                <button
                  type="button"
                  onClick={handleResetApplication}
                  disabled={state.uploadedDocuments.length === 0 || resetting || submitting}
                  className="inline-flex items-center gap-3 border border-black bg-black px-5 py-3 text-sm font-semibold uppercase tracking-[0.16em] text-white transition hover:bg-black/90 disabled:cursor-not-allowed disabled:opacity-35"
                  style={{ color: "#ffffff" }}
                >
                  {resetting ? "Resetting..." : "Reset Application"}
                </button>
                <div className="inline-flex items-center gap-3 border border-black/10 bg-white/70 px-5 py-3 text-sm uppercase tracking-[0.16em] text-[var(--foreground-soft)]">
                  <span className="font-mono">{state.applicationId}</span>
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
                  <span>Live State Sync</span>
                </div>
              </div>
            </div>

            <div className="grid gap-4">
              <div className="border border-black/10 bg-white/78 p-6 shadow-[0_30px_70px_rgba(20,16,13,0.08)] backdrop-blur">
                <p className="font-mono text-[11px] uppercase tracking-[0.26em] text-[var(--muted)]">
                  Progress
                </p>
                <div className="mt-4 flex items-end justify-between gap-4">
                  <div className="text-[clamp(3rem,7vw,5.5rem)] font-semibold leading-none tracking-[-0.06em]">
                    {state.progressPercent}%
                  </div>
                  <div className="max-w-[12rem] text-right text-sm leading-6 text-[var(--foreground-soft)]">
                    {verifiedCount} of {requiredDocumentTypes.length} mandatory files cleared.
                  </div>
                </div>
                <div className="mt-5 h-3 w-full overflow-hidden bg-black/8">
                  <motion.div
                    initial={false}
                    animate={{ width: `${state.progressPercent}%` }}
                    transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                    className="h-full bg-[linear-gradient(90deg,var(--accent)_0%,#ffb06d_100%)]"
                  />
                </div>
                <div className="mt-6 grid gap-3 text-sm text-[var(--foreground-soft)] sm:grid-cols-3">
                  <div className="border border-black/8 bg-[var(--panel)] p-3">
                    <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--muted)]">
                      Intake
                    </p>
                    <p className="mt-2">Uploads accepted through a typed document intake form.</p>
                  </div>
                  <div className="border border-black/8 bg-[var(--panel)] p-3">
                    <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--muted)]">
                      Authenticity
                    </p>
                    <p className="mt-2">
                      Signature, MIME, size, duplicate, and filename checks run automatically.
                    </p>
                  </div>
                  <div className="border border-black/8 bg-[var(--panel)] p-3">
                    <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--muted)]">
                      Alerts
                    </p>
                    <p className="mt-2">
                      Missing or rejected files trigger stateful warnings immediately.
                    </p>
                  </div>
                </div>
              </div>

              <div className="border border-[var(--accent)]/30 bg-[linear-gradient(135deg,rgba(232,109,31,0.12),rgba(255,255,255,0.78))] p-6">
                <p className="font-mono text-[11px] uppercase tracking-[0.26em] text-[var(--muted)]">
                  Runtime
                </p>
                <div className="mt-3 flex items-center justify-between gap-4 text-sm text-[var(--foreground)]">
                  <span>{hasPendingChecks ? "Verification queue active" : "Verification queue idle"}</span>
                  <span className="font-mono text-[var(--foreground-soft)]">
                    Updated {formatTimestamp(state.updatedAt)}
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="mx-auto grid max-w-[1500px] gap-8 px-5 py-10 sm:px-8 lg:grid-cols-[0.78fr_1.22fr]">
        <motion.aside
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.2 }}
          variants={panelReveal}
          className="space-y-8"
        >
          <div className="border border-black/10 bg-white/80 p-6 shadow-[0_18px_45px_rgba(20,16,13,0.07)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--muted)]">
                  Upload Intake
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em]">
                  Submit a document
                </h2>
              </div>
              <div className="text-right text-xs uppercase tracking-[0.18em] text-[var(--foreground-soft)]">
                Rule-based verification
              </div>
            </div>

            <form onSubmit={handleSubmit} className="mt-6 space-y-5">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-[var(--foreground-soft)]">
                  Document type
                </span>
                <select
                  value={selectedType}
                  onChange={(event) => setSelectedType(event.target.value as DocumentType)}
                  className="w-full border border-black/12 bg-[var(--panel)] px-4 py-3 text-base outline-none transition focus:border-[var(--accent)]"
                >
                  {requiredDocumentTypes.map((documentType) => (
                    <option key={documentType} value={documentType}>
                      {documentTypeLabels[documentType]}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-[var(--foreground-soft)]">
                  File
                </span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
                  className="block w-full border border-dashed border-black/20 bg-[var(--panel)] px-4 py-4 text-sm text-[var(--foreground-soft)] file:mr-4 file:border-0 file:bg-[var(--accent)] file:px-4 file:py-2 file:font-semibold file:text-white"
                />
              </label>

              <div className="rounded-sm border border-black/10 bg-[var(--panel)] px-4 py-3 text-sm leading-6 text-[var(--foreground-soft)]">
                Automated checks include binary signature matching, allowed MIME rules, file-size
                thresholds, duplicate checksum detection, and filename-risk heuristics.
              </div>

              {error ? (
                <div className="border border-[#c54d2f]/30 bg-[#fff1eb] px-4 py-3 text-sm text-[#8d321d]">
                  {error}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={submitting || resetting}
                className="inline-flex w-full items-center justify-center border border-black bg-black px-5 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-white transition hover:bg-black/90 disabled:cursor-not-allowed disabled:opacity-60"
                style={{ color: "#ffffff" }}
              >
                {submitting ? "Submitting..." : "Upload and Verify"}
              </button>
            </form>
          </div>

          <div className="border border-black/10 bg-white/80 p-6 shadow-[0_18px_45px_rgba(20,16,13,0.07)]">
            <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--muted)]">
              Requirement Coverage
            </p>
            <div className="mt-5 grid gap-3">
              {requiredDocumentTypes.map((documentType) => {
                const status = getRequirementStatus(documentType, state.uploadedDocuments);
                const styles = {
                  verified: "border-[#24704e]/20 bg-[#edf8f1] text-[#1b553b]",
                  verifying: "border-[#d9862d]/20 bg-[#fff6ea] text-[#985a14]",
                  rejected: "border-[#c54d2f]/20 bg-[#fff0ec] text-[#8d321d]",
                  missing: "border-black/10 bg-[var(--panel)] text-[var(--foreground-soft)]",
                }[status];

                return (
                  <div
                    key={documentType}
                    className={`flex items-center justify-between gap-3 border px-4 py-3 ${styles}`}
                  >
                    <span className="font-medium">{documentTypeLabels[documentType]}</span>
                    <span className="font-mono text-[11px] uppercase tracking-[0.22em]">
                      {status}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </motion.aside>

        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.12 }}
          variants={panelReveal}
          className="space-y-8"
        >
          <div className="border border-black/10 bg-white/80 p-6 shadow-[0_18px_45px_rgba(20,16,13,0.07)]">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--muted)]">
                  Triggered Alerts
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em]">
                  Missing-file and rejection logic
                </h2>
              </div>
              <div className="text-right text-sm text-[var(--foreground-soft)]">
                {ready ? "Checking local state" : "Loading local state"}
              </div>
            </div>

            <div className="mt-6 grid gap-4">
              <AnimatePresence mode="popLayout">
                {state.alerts.length > 0 ? (
                  state.alerts.map((alert) => {
                    const tone = {
                      info: "border-[#315a8e]/20 bg-[#eef5ff] text-[#21456e]",
                      warning: "border-[#d9862d]/20 bg-[#fff6ea] text-[#985a14]",
                      critical: "border-[#c54d2f]/20 bg-[#fff0ec] text-[#8d321d]",
                    }[alert.severity];

                    return (
                      <motion.div
                        key={alert.id}
                        layout
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className={`border px-4 py-4 ${tone}`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <span className="text-sm font-medium leading-6">{alert.message}</span>
                          <span className="font-mono text-[11px] uppercase tracking-[0.22em]">
                            {alert.severity}
                          </span>
                        </div>
                      </motion.div>
                    );
                  })
                ) : (
                  <motion.div
                    layout
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="border border-[#24704e]/20 bg-[#edf8f1] px-4 py-4 text-sm text-[#1b553b]"
                  >
                    No active alerts. The application is currently clear.
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className="border border-black/10 bg-white/80 p-6 shadow-[0_18px_45px_rgba(20,16,13,0.07)]">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--muted)]">
                  Verification Feed
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em]">
                  Uploaded documents
                </h2>
              </div>
              <div className="text-right text-sm text-[var(--foreground-soft)]">
                {deferredDocuments.length} file(s) ingested
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <AnimatePresence mode="popLayout">
                {deferredDocuments.length > 0 && activeDocument ? (
                  <>
                    <div className="flex flex-col gap-4 border border-black/10 bg-white/72 p-4">
                      <div className="flex flex-wrap gap-2">
                        {deferredDocuments.map((document, index) => {
                          const selected = document.id === activeDocument.id;
                          const tone = {
                            verified: "border-[#24704e]/20 bg-[#edf8f1] text-[#1b553b]",
                            verifying: "border-[#d9862d]/20 bg-[#fff6ea] text-[#985a14]",
                            rejected: "border-[#c54d2f]/20 bg-[#fff0ec] text-[#8d321d]",
                          }[document.status];

                          return (
                            <button
                              key={document.id}
                              type="button"
                              onClick={() => setActiveDocumentId(document.id)}
                              className={`inline-flex items-center gap-3 border px-4 py-3 text-left transition ${
                                selected
                                  ? "border-black bg-black text-white"
                                  : `${tone} hover:border-black/30`
                              }`}
                            >
                              <span className="font-mono text-[11px] uppercase tracking-[0.18em]">
                                {index + 1}
                              </span>
                              <span className="max-w-[12rem] truncate text-sm font-medium">
                                {document.fileName}
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-4">
                        <p className="text-sm text-[var(--foreground-soft)]">
                          Viewing document {resolvedDocumentIndex + 1} of {deferredDocuments.length}
                        </p>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={showPreviousDocument}
                            disabled={deferredDocuments.length < 2}
                            className="inline-flex h-10 w-10 items-center justify-center border border-black/12 bg-white text-lg text-[var(--foreground)] transition hover:border-black/30 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            ←
                          </button>
                          <button
                            type="button"
                            onClick={showNextDocument}
                            disabled={deferredDocuments.length < 2}
                            className="inline-flex h-10 w-10 items-center justify-center border border-black/12 bg-white text-lg text-[var(--foreground)] transition hover:border-black/30 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            →
                          </button>
                        </div>
                      </div>
                    </div>

                    {(() => {
                      const document = activeDocument;
                      const statusTone = {
                        verified: "bg-[#edf8f1] text-[#1b553b]",
                        verifying: "bg-[#fff6ea] text-[#985a14]",
                        rejected: "bg-[#fff0ec] text-[#8d321d]",
                      }[document.status];
                      const summary = summarizeChecks(document);

                      return (
                        <motion.article
                          key={document.id}
                          layout
                          initial={{ opacity: 0, y: 18 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -12 }}
                          className="border border-black/10 bg-[var(--panel)] p-5"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-4">
                            <div>
                              <div className="flex flex-wrap items-center gap-3">
                                <h3 className="text-lg font-semibold tracking-[-0.03em]">
                                  {document.fileName}
                                </h3>
                                <span
                                  className={`px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.22em] ${statusTone}`}
                                >
                                  {document.status}
                                </span>
                              </div>
                              <p className="mt-2 text-sm text-[var(--foreground-soft)]">
                                {documentTypeLabels[document.documentType]} | {formatBytes(document.fileSize)} |{" "}
                                {document.mimeType || "Unknown MIME"} | Uploaded{" "}
                                {formatTimestamp(document.uploadedAt)}
                              </p>
                            </div>
                            <div className="flex items-start gap-4">
                              <button
                                type="button"
                                onClick={() => handleDeleteDocument(document.id, document.fileName)}
                                disabled={Boolean(deletingDocumentId) || submitting || resetting}
                                aria-label={`Delete ${document.fileName}`}
                                title="Delete uploaded file"
                                className="inline-flex h-10 w-10 items-center justify-center border border-black/12 bg-white text-xl leading-none text-[var(--foreground)] transition hover:border-[#c54d2f]/35 hover:text-[#8d321d] disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                {deletingDocumentId === document.id ? "..." : "×"}
                              </button>
                              <div className="text-right">
                                <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--muted)]">
                                  Authenticity score
                                </p>
                                <div className="mt-2 text-3xl font-semibold tracking-[-0.05em]">
                                  {document.status === "verifying" ? "--" : document.authenticityScore}
                                </div>
                              </div>
                            </div>
                          </div>

                          {document.rejectionReason ? (
                            <div className="mt-4 border border-[#c54d2f]/20 bg-[#fff0ec] px-4 py-3 text-sm text-[#8d321d]">
                              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#8d321d]/80">
                                How to fix this upload
                              </p>
                              <p className="mt-2 leading-6">{document.rejectionReason}</p>
                            </div>
                          ) : null}

                          <div className="mt-5 grid gap-3 sm:grid-cols-3">
                            <div className="border border-black/10 bg-white/70 px-4 py-3 text-sm text-[var(--foreground-soft)]">
                              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--muted)]">
                                Check summary
                              </p>
                              <p className="mt-2">
                                {summary.pass} pass / {summary.warn} warn / {summary.fail} fail
                              </p>
                            </div>
                            <div className="border border-black/10 bg-white/70 px-4 py-3 text-sm text-[var(--foreground-soft)]">
                              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--muted)]">
                                Content hash
                              </p>
                              <p className="mt-2 font-mono text-[12px]">{document.checksum.slice(0, 16)}...</p>
                            </div>
                            <div className="border border-black/10 bg-white/70 px-4 py-3 text-sm text-[var(--foreground-soft)]">
                              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--muted)]">
                                Decision
                              </p>
                              <p className="mt-2">
                                {document.status === "verified"
                                  ? "Accepted into application packet."
                                  : document.status === "verifying"
                                    ? "Awaiting automated review completion."
                                    : "Rejected until a compliant replacement is uploaded."}
                              </p>
                            </div>
                          </div>

                          {document.checks.length > 0 ? (
                            <div className="mt-5 grid gap-3 sm:grid-cols-2">
                              {document.checks.map((check) => {
                                const tone = {
                                  pass: "border-[#24704e]/18 bg-[#edf8f1] text-[#1b553b]",
                                  warn: "border-[#d9862d]/18 bg-[#fff6ea] text-[#985a14]",
                                  fail: "border-[#c54d2f]/18 bg-[#fff0ec] text-[#8d321d]",
                                }[check.status];

                                return (
                                  <div key={`${document.id}-${check.code}`} className={`border px-4 py-3 ${tone}`}>
                                    <div className="flex items-center justify-between gap-3">
                                      <p className="text-sm font-medium">{check.label}</p>
                                      <span className="font-mono text-[11px] uppercase tracking-[0.22em]">
                                        {check.status}
                                      </span>
                                    </div>
                                    <p className="mt-2 text-sm leading-6">{check.detail}</p>
                                  </div>
                                );
                              })}
                            </div>
                          ) : null}
                        </motion.article>
                      );
                    })()}
                  </>
                ) : (
                  <motion.div
                    layout
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="border border-dashed border-black/20 bg-[var(--panel)] px-5 py-10 text-center text-[var(--foreground-soft)]"
                  >
                    No documents uploaded yet. Submit a file to start the verification flow.
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </motion.div>
      </section>
    </main>
  );
}
