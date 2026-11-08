import {
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import { getFirebaseAuth, getGoogleAuthProvider, isFirebaseConfigured } from '../firebase/webFirebase';

export interface AuthUserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

export function formatUserProfile(user: User | null): AuthUserProfile | null {
  if (!user) return null;
  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
  };
}

/**
 * Sign in with Google using Firebase Authentication on Web / PWA.
 * Attempts popup first; if popup is blocked or on certain mobile web browsers, falls back to redirect.
 */
export async function signInWithGoogle(): Promise<AuthUserProfile | null> {
  if (!isFirebaseConfigured()) {
    throw new Error(
      'Firebase is not configured. Please set EXPO_PUBLIC_FIREBASE_API_KEY and related variables in .env.local.'
    );
  }

  const auth = getFirebaseAuth();
  const provider = getGoogleAuthProvider();
  if (!auth || !provider) {
    throw new Error('Unable to initialize Firebase Auth or Google Provider.');
  }

  try {
    const result = await signInWithPopup(auth, provider);
    return formatUserProfile(result.user);
  } catch (error: any) {
    // If popup was blocked or closed by user, attempt redirect sign-in
    if (
      error.code === 'auth/popup-blocked' ||
      error.code === 'auth/popup-closed-by-user' ||
      error.code === 'auth/cancelled-popup-request'
    ) {
      console.log('[Auth] Popup unavailable or dismissed, attempting signInWithRedirect...');
      await signInWithRedirect(auth, provider);
      return null;
    }
    throw error;
  }
}

/**
 * Check for redirect sign-in result after page reloads from redirect
 */
export async function checkRedirectAuth(): Promise<AuthUserProfile | null> {
  const auth = getFirebaseAuth();
  if (!auth) return null;
  try {
    const result = await getRedirectResult(auth);
    if (result && result.user) {
      return formatUserProfile(result.user);
    }
  } catch (err) {
    console.warn('[Auth] Redirect sign-in check failed:', err);
  }
  return null;
}

/**
 * Sign out current user
 */
export async function signOutUser(): Promise<void> {
  const auth = getFirebaseAuth();
  if (auth) {
    await signOut(auth);
  }
}

/**
 * Subscribe to auth state changes
 */
export function subscribeToAuthState(callback: (user: AuthUserProfile | null) => void): () => void {
  const auth = getFirebaseAuth();
  if (!auth) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(auth, (user) => {
    callback(formatUserProfile(user));
  });
}

/**
 * Get currently signed in user synchronously
 */
export function getCurrentUser(): AuthUserProfile | null {
  const auth = getFirebaseAuth();
  if (!auth || !auth.currentUser) return null;
  return formatUserProfile(auth.currentUser);
}

