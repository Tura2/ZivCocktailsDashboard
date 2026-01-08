let currentJobId: string | null = null;
const listeners = new Set<(jobId: string | null) => void>();

const STORAGE_KEY = 'ziv.refresh.jobId.v1';

function safeReadSessionStorage(): string | null {
  try {
    const v = sessionStorage.getItem(STORAGE_KEY);
    return v && v.trim() ? v.trim() : null;
  } catch {
    return null;
  }
}

function safeWriteSessionStorage(jobId: string | null) {
  try {
    if (!jobId) {
      sessionStorage.removeItem(STORAGE_KEY);
      return;
    }
    sessionStorage.setItem(STORAGE_KEY, jobId);
  } catch {
    // ignore
  }
}

// Initialize from session storage so reloads in the same session keep state.
currentJobId = safeReadSessionStorage();

export function getRefreshJobId(): string | null {
  return currentJobId;
}

export function setRefreshJobId(jobId: string | null) {
  currentJobId = jobId;
  safeWriteSessionStorage(jobId);
  for (const l of listeners) l(currentJobId);
}

export function subscribeRefreshJobId(listener: (jobId: string | null) => void): () => void {
  listeners.add(listener);
  listener(currentJobId);
  return () => {
    listeners.delete(listener);
  };
}
