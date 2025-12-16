import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth, firebaseEnabled } from '@/lib/firebase';

export async function loginUser(input: { email: string; password: string }) {
  if (!firebaseEnabled || !auth) {
    throw new Error('Firebase is not configured. Set VITE_FIREBASE_* in .env.');
  }

  const credential = await signInWithEmailAndPassword(auth, input.email, input.password);
  return {
    uid: credential.user.uid,
    email: credential.user.email,
  };
}

export async function registerUser(input: { name: string; email: string; password: string }) {
  if (!firebaseEnabled || !auth) {
    throw new Error('Firebase is not configured. Set VITE_FIREBASE_* in .env.');
  }

  const credential = await createUserWithEmailAndPassword(auth, input.email, input.password);
  if (input.name) {
    await updateProfile(credential.user, { displayName: input.name });
  }

  return {
    uid: credential.user.uid,
    email: credential.user.email,
  };
}
