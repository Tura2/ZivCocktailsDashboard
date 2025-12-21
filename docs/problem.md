🧠 Agent Prompt — Debug “Invalid or expired ID token (invalid_token)” between Electron app and Refresh backend

Role
You are a senior Firebase / Auth / Cloud Functions engineer.

Goal
Investigate and resolve the recurring error:

Invalid or expired ID token (invalid_token)


when the Electron + Vite renderer calls the Refresh backend endpoint.

Your job is to verify what is implemented vs. what is missing, and apply only the necessary fixes.

🧩 System Context (must be respected)
Frontend

Electron desktop app

React + Vite renderer

Firebase Auth used for user sign-in

Refresh call uses:

POST

Authorization: Bearer <token>

Content-Type: application/json

Refresh URL is provided via:

import.meta.env.VITE_REFRESH_URL

Backend

Firebase Cloud Functions v2 (HTTP)

Deployed as Gen2 → Cloud Run

Refresh endpoint currently resolves to a URL like:

https://refresh-<hash>.a.run.app


Backend verifies Firebase ID token using Firebase Admin SDK:

verifyIdToken(...)

Backend already has:

CORS middleware

OPTIONS preflight handling

POST method guard

Business logic + Firestore writes

❗ Problem Description

Calling the Refresh endpoint sometimes fails with:

Invalid or expired ID token (invalid_token)


This error appeared previously and may be re-introduced after:

Switching endpoint URLs

Changing deployment target (Cloud Run / Gen2)

Updating auth or env configuration

✅ Expected Correct Architecture (reference model)
Client (renderer)

Uses Firebase Auth

Obtains token via:

const idToken = await auth.currentUser.getIdToken();


Sends:

Authorization: Bearer <Firebase ID token>


Does NOT:

Send Google OAuth access tokens

Send refresh tokens

Cache ID tokens long-term

On 401, should:

Force refresh token once (getIdToken(true))

Retry request

Backend (refresh function)

Uses Firebase Admin SDK:

getAuth().verifyIdToken(token)


Verifies:

Token type is Firebase ID token

Token aud matches the same Firebase project

Does NOT rely on Cloud Run IAM auth for end-user auth

Allows HTTP invocation and enforces auth inside code

🔍 What You Must Check (step-by-step)
1️⃣ Client-side verification

Find where the Refresh request is made

Confirm:

Token is retrieved via getIdToken()

Token is fresh (not cached)

Authorization header is correctly formed

Confirm Firebase client config project ID matches backend project

2️⃣ Server-side verification

Locate token verification logic

Confirm:

verifyIdToken is used (not Google token verification)

No assumptions about Cloud Run IAM identity

Temporarily log:

Authorization header prefix

Decoded token aud and iss (redacted)

3️⃣ Deployment / infra mismatch

Confirm:

Backend Firebase Admin is initialized for the same project

Cloud Run service is not requiring IAM identity tokens

Verify:

This endpoint expects Firebase ID tokens, not Google identity tokens

4️⃣ Expiry / retry logic

Check if frontend retries with getIdToken(true) on 401

If missing, implement minimal retry logic

🛠️ What to Fix (only if missing)

Apply fixes only if the check shows they are missing:

Token retrieval method

Token refresh strategy

Auth project mismatch

Cloud Run auth configuration mismatch

Improper header handling

Do not refactor unrelated code.

📦 Deliverable Back to Me

Return:

What was already correct

What was missing or incorrect

Exact file paths changed (if any)

Code snippets of the fix

A short explanation of why this caused invalid_token

🚫 Hard Rules

Do not disable authentication

Do not switch auth systems

Do not introduce Google OAuth tokens

Do not rewrite architecture

No frontend hacks (no no-cors, no fake headers)

If you complete this properly, the Refresh call should:

Work consistently

Survive token expiration

Work both in dev and prod

Be secure and predictable