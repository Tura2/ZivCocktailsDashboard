import admin from 'firebase-admin';

let app: admin.app.App | null = null;
let db: admin.firestore.Firestore | null = null;

export function getAdminApp(): admin.app.App {
  if (app) return app;
  app = admin.initializeApp();
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
