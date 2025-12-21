import admin from 'firebase-admin';

let app: admin.app.App | null = null;
let db: admin.firestore.Firestore | null = null;

function resolveProjectId(): string | undefined {
  const gcloud = process.env.GCLOUD_PROJECT;
  if (gcloud && gcloud.trim()) return gcloud.trim();

  const firebaseConfig = process.env.FIREBASE_CONFIG;
  if (firebaseConfig) {
    try {
      const parsed = JSON.parse(firebaseConfig) as any;
      const projectId = parsed?.projectId;
      if (typeof projectId === 'string' && projectId.trim()) return projectId.trim();
    } catch {
      // ignore
    }
  }

  return undefined;
}

export function getAdminApp(): admin.app.App {
  if (app) return app;
  const projectId = resolveProjectId();
  app = projectId ? admin.initializeApp({ projectId }) : admin.initializeApp();
  return app;
}

export function getDb(): admin.firestore.Firestore {
  getAdminApp();
  if (db) return db;
  db = admin.firestore();
  // Needed because compute engine can produce optional fields that are undefined.
  // Without this, Firestore writes fail with "Cannot use undefined as a Firestore value".
  db.settings({ ignoreUndefinedProperties: true });
  return db;
}

export { admin };
