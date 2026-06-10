import admin from "firebase-admin";

let adminAuthInstance: admin.auth.Auth | null = null;

function initializeFirebase() {
  if (adminAuthInstance) return adminAuthInstance;
  
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID!,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      }),
    });
  }
  
  adminAuthInstance = admin.auth();
  return adminAuthInstance;
}

export function getAdminAuth() {
  return initializeFirebase();
}

// Default export for lazy initialization
export const adminAuth = new Proxy({} as admin.auth.Auth, {
  get(_, prop) {
    return (getAdminAuth() as any)[prop];
  },
});
