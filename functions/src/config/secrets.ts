import { defineSecret } from 'firebase-functions/params';

// Secrets (stored in Google Cloud Secret Manager).
// These are not sourced from functions/.env at runtime in production.
export const CLICKUP_API_TOKEN = defineSecret('CLICKUP_API_TOKEN');
export const INSTAGRAM_ACCESS_TOKEN = defineSecret('INSTAGRAM_ACCESS_TOKEN');
export const INSTAGRAM_IG_USER_ID = defineSecret('INSTAGRAM_IG_USER_ID');
