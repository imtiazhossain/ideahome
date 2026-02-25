import { Injectable, OnModuleInit } from "@nestjs/common";
import * as admin from "firebase-admin";

export type FirebaseDecodedToken = {
  uid: string;
  email?: string;
  name?: string;
};

@Injectable()
export class FirebaseService implements OnModuleInit {
  private app: admin.app.App | null = null;

  onModuleInit(): void {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const saJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    const adcPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (!projectId && !saJson && !adcPath) return;

    try {
      if (saJson) {
        const credential = admin.credential.cert(
          JSON.parse(saJson) as admin.ServiceAccount
        );
        this.app = admin.initializeApp({
          credential,
          projectId: projectId ?? undefined,
        });
      } else {
        this.app = admin.initializeApp({
          credential: admin.credential.applicationDefault(),
          projectId: projectId ?? undefined,
        });
      }
    } catch (e) {
      console.warn("Firebase Admin init failed:", e);
    }
  }

  isConfigured(): boolean {
    return this.app != null;
  }

  async verifyIdToken(idToken: string): Promise<FirebaseDecodedToken | null> {
    if (!this.app) return null;
    try {
      const decoded = await this.app.auth().verifyIdToken(idToken);
      const payload = decoded as {
        uid: string;
        email?: string;
        name?: string;
        display_name?: string;
      };
      return {
        uid: payload.uid,
        email: payload.email ?? undefined,
        name: payload.name ?? payload.display_name ?? undefined,
      };
    } catch {
      return null;
    }
  }
}
