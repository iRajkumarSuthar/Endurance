import {
  requiredDocumentTypes,
  type ApplicationAlertRecord,
  type ApplicationDocumentRecord,
  type ApplicationEventRecord,
  type ApplicationRecord,
  type DocumentType,
  type UserRecord,
  type VerificationCheck,
  type VerificationCheckRecord,
} from "@/lib/student-application-schema";

const STORAGE_KEY = "endurance-application-store-v1";
const DEMO_USER_ID = "demo-user-student";
const DEMO_APPLICATION_ID = "APP-STUDENT-0001";

export type NewDocumentInput = {
  applicationId: string;
  userId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  checksum: string;
  documentType: DocumentType;
  status: "verifying" | "verified" | "rejected";
  authenticityScore: number;
  rejectionReason?: string;
  uploadedAt: string;
};

export type NewEventInput = {
  applicationId: string;
  eventType: ApplicationEventRecord["eventType"];
  payload: Record<string, string>;
};

type ApplicationTables = {
  users: UserRecord[];
  applications: ApplicationRecord[];
  documents: Array<ApplicationDocumentRecord>;
  verificationChecks: VerificationCheckRecord[];
  alerts: ApplicationAlertRecord[];
  events: ApplicationEventRecord[];
};

function createId(prefix: string) {
  const generator = globalThis.crypto?.randomUUID;
  if (generator) {
    return `${prefix}_${generator()}`;
  }

  return `${prefix}_${Date.now()}-${Math.floor(Math.random() * 999_999_999)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function getEmptyStore(): ApplicationTables {
  return {
    users: [],
    applications: [],
    documents: [],
    verificationChecks: [],
    alerts: [],
    events: [],
  };
}

const inMemoryFallbackStore: ApplicationTables = getEmptyStore();
let initialized = false;

function isBrowser() {
  return typeof window !== "undefined";
}

function createDefaultUser(): UserRecord {
  const createdAt = nowIso();
  return {
    id: DEMO_USER_ID,
    email: "demo@student.endurance.local",
    displayName: "Demo Student",
    role: "student",
    createdAt,
    updatedAt: createdAt,
  };
}

function createDefaultApplication(userId: string): ApplicationRecord {
  const createdAt = nowIso();
  return {
    id: DEMO_APPLICATION_ID,
    userId,
    status: "active",
    requiredDocuments: [...requiredDocumentTypes],
    createdAt,
    updatedAt: createdAt,
  };
}

function hydrateTable(): ApplicationTables {
  if (!isBrowser()) {
    if (!initialized) {
      if (inMemoryFallbackStore.users.length === 0) {
        const user = createDefaultUser();
        inMemoryFallbackStore.users.push(user);
        inMemoryFallbackStore.applications.push(createDefaultApplication(user.id));
      }

      initialized = true;
    }

    return inMemoryFallbackStore;
  }

  if (!initialized) {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Partial<ApplicationTables>;
        if (Array.isArray(parsed.users) && Array.isArray(parsed.applications)) {
          inMemoryFallbackStore.users = parsed.users ?? [];
          inMemoryFallbackStore.applications = parsed.applications ?? [];
          inMemoryFallbackStore.documents = parsed.documents ?? [];
          inMemoryFallbackStore.verificationChecks = parsed.verificationChecks ?? [];
          inMemoryFallbackStore.alerts = parsed.alerts ?? [];
          inMemoryFallbackStore.events = parsed.events ?? [];
        }
      } catch (error) {
        console.warn("[persistence] Falling back to in-memory seed due to invalid state file.");
      }
    }

    if (inMemoryFallbackStore.users.length === 0) {
      const user = createDefaultUser();
      inMemoryFallbackStore.users.push(user);
      inMemoryFallbackStore.applications.push(createDefaultApplication(user.id));
      persistStore(inMemoryFallbackStore);
    }

    initialized = true;
  }

  return inMemoryFallbackStore;
}

function persistStore(store: ApplicationTables) {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

function ensureApplication(applicationId: string, userId: string) {
  const store = hydrateTable();
  let application = store.applications.find((item) => item.id === applicationId);
  if (!application) {
    application = createDefaultApplication(userId);
    application.id = applicationId;
    store.applications.push(application);
    persistStore(store);
  } else if (application.userId !== userId) {
    application.userId = userId;
    application.updatedAt = nowIso();
    persistStore(store);
  }

  return application;
}

function ensureUser(userId: string) {
  const store = hydrateTable();
  let user = store.users.find((item) => item.id === userId);
  if (!user) {
    user = createDefaultUser();
    user.id = userId;
    store.users.push(user);
    persistStore(store);
  }

  return user;
}

export function getUsersStore() {
  return hydrateTable();
}

export function ensureApplicationData(userId: string = DEMO_USER_ID, applicationId: string = DEMO_APPLICATION_ID) {
  const store = hydrateTable();
  const user = ensureUser(userId);
  const application = ensureApplication(applicationId, user.id);
  return { user, application };
}

export function getApplicationRecord(applicationId: string) {
  return hydrateTable().applications.find((item) => item.id === applicationId) ?? null;
}

export function getDocumentsForApplication(applicationId: string) {
  return hydrateTable().documents.filter((document) => document.applicationId === applicationId);
}

export function getDocumentById(documentId: string) {
  return hydrateTable().documents.find((document) => document.id === documentId) ?? null;
}

export function writeDocument(input: NewDocumentInput, id?: string): ApplicationDocumentRecord {
  const store = hydrateTable();
  const documentId = id ?? createId("doc");
  const now = nowIso();
  const existing = store.documents.find((document) => document.id === documentId);
  const document: ApplicationDocumentRecord = {
    id: documentId,
    applicationId: input.applicationId,
    userId: input.userId,
    fileName: input.fileName,
    fileSize: input.fileSize,
    mimeType: input.mimeType,
    checksum: input.checksum,
    documentType: input.documentType,
    status: input.status,
    uploadedAt: input.uploadedAt,
    authenticityScore: input.authenticityScore,
    rejectionReason: input.rejectionReason,
    checks: [],
    checkIds: [],
    createdAt: now,
    updatedAt: now,
  };

  if (existing) {
    store.documents = store.documents.filter((item) => item.id !== documentId);
  }

  store.documents = [document, ...store.documents.filter((item) => item.id !== documentId)];
  persistStore(store);
  return document;
}

export function updateDocument(documentId: string, patch: Partial<ApplicationDocumentRecord>) {
  const store = hydrateTable();
  const index = store.documents.findIndex((document) => document.id === documentId);
  if (index === -1) {
    return null;
  }

  store.documents[index] = {
    ...store.documents[index],
    ...patch,
    updatedAt: nowIso(),
  };

  persistStore(store);
  return store.documents[index];
}

export function appendVerificationChecks(applicationId: string, documentId: string, checks: VerificationCheck[]) {
  const store = hydrateTable();
  const checkIds: string[] = [];
  const createdAt = nowIso();

  for (const check of checks) {
    const checkId = createId("chk");
    const checkRecord: VerificationCheckRecord = {
      ...check,
      id: checkId,
      applicationId,
      documentId,
      createdAt,
    };

    store.verificationChecks.push(checkRecord);
    checkIds.push(checkId);
  }

  const document = getDocumentById(documentId);
  if (!document) {
    persistStore(store);
    return [];
  }

  document.checkIds = checkIds;
  persistStore(store);
  return checkIds;
}

export function getChecksForDocument(documentId: string) {
  return hydrateTable().verificationChecks.filter((item) => item.documentId === documentId);
}

export function appendApplicationEvent(input: NewEventInput) {
  const store = hydrateTable();
  store.events.push({
    id: createId("evt"),
    applicationId: input.applicationId,
    eventType: input.eventType,
    payload: input.payload,
    createdAt: nowIso(),
  });

  persistStore(store);
}

export function upsertAlert(alert: Omit<ApplicationAlertRecord, "createdAt" | "resolvedAt">) {
  const store = hydrateTable();
  const existing = store.alerts.find((item) => item.dedupeKey === alert.dedupeKey && item.applicationId === alert.applicationId);
  const now = nowIso();

  if (existing) {
    existing.message = alert.message;
    existing.severity = alert.severity;
    existing.createdAt = now;
    existing.id = alert.id;
    existing.resolvedAt = undefined;
    persistStore(store);
    return existing;
  }

  const record: ApplicationAlertRecord = {
    ...alert,
    createdAt: now,
    id: alert.id,
    resolvedAt: undefined,
  };

  store.alerts.push(record);
  persistStore(store);
  return record;
}

export function clearAlerts(applicationId: string) {
  const store = hydrateTable();
  store.alerts = store.alerts.filter((item) => item.applicationId !== applicationId);
  persistStore(store);
}

export function getAlertsForApplication(applicationId: string) {
  return hydrateTable().alerts.filter((item) => item.applicationId === applicationId);
}

export function listChecksumsForApplication(applicationId: string) {
  return new Set(
    getDocumentsForApplication(applicationId).map((document) => document.checksum)
  );
}

export { DEMO_APPLICATION_ID, DEMO_USER_ID };
