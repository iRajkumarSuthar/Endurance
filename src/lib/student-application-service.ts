import {
  documentTypeLabels,
  requiredDocumentTypes,
  type ApplicationAlert,
  type ApplicationState,
  type DocumentType,
  type UploadedDocument,
  type VerificationCheck,
} from "@/lib/student-application-schema";
import {
  DEMO_APPLICATION_ID,
  DEMO_USER_ID,
  appendApplicationEvent,
  appendVerificationChecks,
  getApplicationRecord,
  getChecksForDocument,
  getDocumentById,
  getDocumentsForApplication,
  listChecksumsForApplication,
  ensureApplicationData,
  updateDocument,
  writeDocument,
} from "@/lib/application-store";

type VerificationResult = {
  status: "verified" | "rejected";
  authenticityScore: number;
  checks: VerificationCheck[];
  rejectionReason?: string;
};

type AppEntity = {
  applicationId: string;
  documents: UploadedDocument[];
};

const APPLICATION_ID = DEMO_APPLICATION_ID;
const USER_ID = DEMO_USER_ID;

const MIN_FILE_SIZE_BYTES = 20 * 1024;
const MAX_FILE_SIZE_BYTES = 12 * 1024 * 1024;
const MIN_SCORE_TO_VERIFY = 70;

const allowedMimeTypes: Record<DocumentType, string[]> = {
  passport: ["application/pdf", "image/jpeg", "image/png"],
  transcript: ["application/pdf", "image/jpeg", "image/png"],
  bankStatement: ["application/pdf", "image/jpeg", "image/png"],
  statementOfPurpose: ["application/pdf"],
  resume: ["application/pdf"],
  englishTest: ["application/pdf", "image/jpeg", "image/png"],
};

const allowedExtensions: Record<DocumentType, string[]> = {
  passport: [".pdf", ".jpg", ".jpeg", ".png"],
  transcript: [".pdf", ".jpg", ".jpeg", ".png"],
  bankStatement: [".pdf", ".jpg", ".jpeg", ".png"],
  statementOfPurpose: [".pdf"],
  resume: [".pdf"],
  englishTest: [".pdf", ".jpg", ".jpeg", ".png"],
};

const filenameSignals: Record<DocumentType, string[]> = {
  passport: ["passport"],
  transcript: ["transcript", "marksheet", "academic"],
  bankStatement: ["bank", "statement", "balance"],
  statementOfPurpose: ["sop", "statement", "purpose"],
  resume: ["resume", "cv"],
  englishTest: ["ielts", "toefl", "pte", "duolingo", "english"],
};

const magicSignatures = {
  pdf: [0x25, 0x50, 0x44, 0x46],
  png: [0x89, 0x50, 0x4e, 0x47],
  jpg: [0xff, 0xd8, 0xff],
};

function getExtension(fileName: string) {
  const match = fileName.toLowerCase().match(/\.[a-z0-9]+$/);
  return match ? match[0] : "";
}

function hasSignature(bytes: Uint8Array, signature: number[]) {
  if (bytes.length < signature.length) {
    return false;
  }

  return signature.every((value, index) => bytes[index] === value);
}

function detectFileSignature(bytes: Uint8Array): "pdf" | "png" | "jpg" | "unknown" {
  if (hasSignature(bytes, magicSignatures.pdf)) {
    return "pdf";
  }

  if (hasSignature(bytes, magicSignatures.png)) {
    return "png";
  }

  if (hasSignature(bytes, magicSignatures.jpg)) {
    return "jpg";
  }

  return "unknown";
}

function toHex(value: ArrayLike<number>) {
  return Array.from(value)
    .map((part) => part.toString(16).padStart(2, "0"))
    .join("");
}

async function sha256Hex(bytes: Uint8Array) {
  if (!globalThis.crypto?.subtle) {
    throw new Error("Web Crypto API not available.");
  }

  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return toHex(new Uint8Array(digest));
}

function expectedSignaturesByExtension(extension: string): Array<"pdf" | "png" | "jpg"> {
  if (extension === ".pdf") {
    return ["pdf"];
  }

  if (extension === ".png") {
    return ["png"];
  }

  if (extension === ".jpg" || extension === ".jpeg") {
    return ["jpg"];
  }

  return [];
}

function withDocumentChecks(document: UploadedDocument): UploadedDocument {
  if (document.checks.length > 0) {
    return document;
  }

  const persistedChecks = getChecksForDocument(document.id);
  if (persistedChecks.length === 0) {
    return document;
  }

  return {
    ...document,
    checks: persistedChecks,
  };
}

function readApplicationState(): AppEntity {
  const persisted = getApplicationRecord(APPLICATION_ID);
  const documents = getDocumentsForApplication(APPLICATION_ID).map(withDocumentChecks);

  const hasFallback = persisted && persisted.id;
  if (!hasFallback) {
    ensureApplicationData(USER_ID, APPLICATION_ID);
  }

  return {
    applicationId: persisted?.id ?? APPLICATION_ID,
    documents: documents.sort((a, b) => Date.parse(b.uploadedAt) - Date.parse(a.uploadedAt)),
  };
}

function buildAlerts(state: {
  missingDocuments: DocumentType[];
  documents: UploadedDocument[];
  progressPercent: number;
}): ApplicationAlert[] {
  const alerts: ApplicationAlert[] = [];

  if (state.missingDocuments.length > 0) {
    const missingNames = state.missingDocuments.map((type) => documentTypeLabels[type]);
    alerts.push({
      id: "missing-documents",
      severity: "warning",
      message: `Missing required files: ${missingNames.join(", ")}.`,
    });
  }

  const rejected = state.documents.filter((doc) => doc.status === "rejected");
  if (rejected.length > 0) {
    alerts.push({
      id: "rejected-documents",
      severity: "critical",
      message: `${rejected.length} file(s) rejected by automated authenticity checks.`,
    });
  }

  const verifying = state.documents.filter((doc) => doc.status === "verifying");
  if (verifying.length > 0) {
    alerts.push({
      id: "verification-running",
      severity: "info",
      message: `${verifying.length} file(s) still in verification queue.`,
    });
  }

  if (state.progressPercent === 100) {
    alerts.push({
      id: "ready-for-review",
      severity: "info",
      message: "All mandatory documents verified. Application is ready for review.",
    });
  }

  return alerts;
}

function latestUpdateDate(entity: AppEntity, fallback: string) {
  let latest = Date.parse(fallback);

  for (const document of entity.documents) {
    const uploadedAt = Date.parse(document.uploadedAt);
    if (!Number.isNaN(uploadedAt) && uploadedAt > latest) {
      latest = uploadedAt;
    }
  }

  if (Number.isNaN(latest)) {
    return new Date().toISOString();
  }

  return new Date(latest).toISOString();
}

function computeState(): ApplicationState {
  ensureApplicationData(USER_ID, APPLICATION_ID);
  const applicationRecord = getApplicationRecord(APPLICATION_ID);
  const entity = readApplicationState();
  const verifiedByType = new Set<DocumentType>();
  for (const document of entity.documents) {
    if (document.status === "verified") {
      verifiedByType.add(document.documentType);
    }
  }

  const missingDocuments = requiredDocumentTypes.filter((type) => !verifiedByType.has(type));
  const progressPercent = Math.round(
    ((requiredDocumentTypes.length - missingDocuments.length) / requiredDocumentTypes.length) * 100
  );

  const alerts = buildAlerts({
    missingDocuments,
    documents: entity.documents,
    progressPercent,
  });

  return {
    applicationId: applicationRecord?.id ?? APPLICATION_ID,
    progressPercent,
    requiredDocuments: requiredDocumentTypes,
    missingDocuments,
    uploadedDocuments: entity.documents,
    alerts,
    updatedAt: latestUpdateDate(entity, applicationRecord?.updatedAt ?? new Date().toISOString()),
  };
}

function runAutomatedVerification(args: {
  fileName: string;
  fileSize: number;
  mimeType: string;
  checksum: string;
  documentType: DocumentType;
  bytes: Uint8Array;
  existingChecksums: Set<string>;
}): VerificationResult {
  const checks: VerificationCheck[] = [];
  const extension = getExtension(args.fileName);
  const mimeTypes = allowedMimeTypes[args.documentType];
  const extensions = allowedExtensions[args.documentType];
  const detectedSignature = detectFileSignature(args.bytes);
  const expectedSignatures = expectedSignaturesByExtension(extension);
  const signatureMatches =
    detectedSignature !== "unknown" && expectedSignatures.includes(detectedSignature);
  const filenameRisky = /(edited|copy|final|v\d+|scan|mobile|screenshot)/i.test(args.fileName);
  const normalizedName = args.fileName.toLowerCase();

  if (!extensions.includes(extension)) {
    checks.push({
      code: "extension",
      label: "File extension policy",
      status: "fail",
      detail: `Extension ${extension || "(missing)"} not allowed for ${documentTypeLabels[args.documentType]}.`,
    });
  } else {
    checks.push({
      code: "extension",
      label: "File extension policy",
      status: "pass",
      detail: `Extension ${extension} accepted.`,
    });
  }

  if (!args.mimeType || args.mimeType === "application/octet-stream") {
    checks.push({
      code: "mime-type",
      label: "MIME type policy",
      status: "warn",
      detail: "Browser supplied a generic MIME type. Signature checks are used as fallback.",
    });
  } else if (!mimeTypes.includes(args.mimeType)) {
    checks.push({
      code: "mime-type",
      label: "MIME type policy",
      status: "fail",
      detail: `MIME ${args.mimeType} is not permitted for ${documentTypeLabels[args.documentType]}.`,
    });
  } else {
    checks.push({
      code: "mime-type",
      label: "MIME type policy",
      status: "pass",
      detail: `MIME ${args.mimeType} accepted.`,
    });
  }

  if (args.fileSize > MAX_FILE_SIZE_BYTES) {
    checks.push({
      code: "size",
      label: "File size bounds",
      status: "fail",
      detail: "File exceeds 12MB limit.",
    });
  } else if (args.fileSize < MIN_FILE_SIZE_BYTES) {
    checks.push({
      code: "size",
      label: "File size bounds",
      status: "warn",
      detail: "File is unusually small and may be incomplete.",
    });
  } else {
    checks.push({
      code: "size",
      label: "File size bounds",
      status: "pass",
      detail: "File size falls within expected range.",
    });
  }

  if (expectedSignatures.length === 0 || !signatureMatches) {
    checks.push({
      code: "signature",
      label: "Binary signature integrity",
      status: "fail",
      detail: `Detected signature ${detectedSignature} does not match ${extension || "file type"}.`,
    });
  } else {
    checks.push({
      code: "signature",
      label: "Binary signature integrity",
      status: "pass",
      detail: `Signature check matched ${detectedSignature}.`,
    });
  }

  if (args.existingChecksums.has(args.checksum)) {
    checks.push({
      code: "duplicate",
      label: "Duplicate detection",
      status: "fail",
      detail: "Identical file already uploaded in this application.",
    });
  } else {
    checks.push({
      code: "duplicate",
      label: "Duplicate detection",
      status: "pass",
      detail: "No duplicate content hash found.",
    });
  }

  if (filenameRisky) {
    checks.push({
      code: "filename-risk",
      label: "Filename hygiene signal",
      status: "warn",
      detail: "Filename pattern suggests potential manual edits. Review recommended.",
    });
  } else {
    checks.push({
      code: "filename-risk",
      label: "Filename hygiene signal",
      status: "pass",
      detail: "Filename does not indicate risky edit markers.",
    });
  }

  const semanticMatch = filenameSignals[args.documentType].some((signal) => normalizedName.includes(signal));
  checks.push({
    code: "document-intent",
    label: "Declared document intent",
    status: semanticMatch ? "pass" : "warn",
    detail: semanticMatch
      ? "Filename matches the declared document type."
      : "Filename does not clearly indicate the declared document type.",
  });

  let authenticityScore = 100;
  for (const check of checks) {
    if (check.status === "warn") {
      authenticityScore -= 10;
    } else if (check.status === "fail") {
      authenticityScore -= 35;
    }
  }
  authenticityScore = Math.max(0, authenticityScore);

  const hasHardFailure = checks.some((check) => check.status === "fail");
  const verified = !hasHardFailure && authenticityScore >= MIN_SCORE_TO_VERIFY;

  if (verified) {
    return {
      status: "verified",
      authenticityScore,
      checks,
    };
  }

  const failingChecks = checks
    .filter((check) => check.status === "fail")
    .map((check) => check.label)
    .slice(0, 2)
    .join(", ");

  return {
    status: "rejected",
    authenticityScore,
    checks,
    rejectionReason:
      failingChecks.length > 0
        ? `Automated validation failed: ${failingChecks}.`
        : "Authenticity score below required threshold.",
  };
}

function updateDocumentResult(documentId: string, result: VerificationResult) {
  const document = getDocumentById(documentId);
  if (!document) {
    return;
  }

  const updated = updateDocument(documentId, {
    status: result.status,
    authenticityScore: result.authenticityScore,
    rejectionReason: result.rejectionReason,
    checks: result.checks,
  });

  if (!updated) {
    return;
  }

  appendVerificationChecks(document.applicationId, documentId, result.checks);
  appendApplicationEvent({
    applicationId: document.applicationId,
    eventType: "document_result_updated",
    payload: {
      documentId,
      status: result.status,
      score: String(result.authenticityScore),
      rejectionReason: result.rejectionReason ?? "",
    },
  });
}

export async function enqueueUpload(documentType: DocumentType, file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const checksum = await sha256Hex(bytes);
  const existingChecksums = listChecksumsForApplication(APPLICATION_ID);
  const uploadedAt = new Date().toISOString();
  const { user, application } = ensureApplicationData(USER_ID, APPLICATION_ID);
  const result = runAutomatedVerification({
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.type || "application/octet-stream",
    checksum,
    documentType,
    bytes,
    existingChecksums,
  });
  const pendingRecord = writeDocument({
    applicationId: application.id,
    userId: user.id,
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.type || "application/octet-stream",
    checksum,
    documentType,
    status: "verifying",
    authenticityScore: 0,
    uploadedAt,
  });

  appendApplicationEvent({
    applicationId: application.id,
    eventType: "document_added",
    payload: {
      documentId: pendingRecord.id,
      documentType,
      checksum,
      fileName: file.name,
    },
  });

  const randomDelay = 900 + Math.floor(Math.random() * 1400);
  setTimeout(() => {
    updateDocumentResult(pendingRecord.id, result);
  }, randomDelay);

  return { documentId: pendingRecord.id };
}

export function getApplicationState() {
  return computeState();
}
