const ACCESS_TOKEN_KEY = "agronexus_access_token";
const REFRESH_TOKEN_KEY = "agronexus_refresh_token";
export const AUTH_SESSION_STORAGE_KEY = "agronexus_auth_session";
const CREDENTIALS_PREFIX = `${AUTH_SESSION_STORAGE_KEY}:`;
const CLOSED_PREFIX = `${CREDENTIALS_PREFIX}closed:`;

export interface AuthSessionSnapshot {
  generation: string;
  accessToken: string | null;
  refreshToken: string | null;
}

export interface AuthSessionChange {
  snapshot: AuthSessionSnapshot;
  identityChanged: boolean;
  external: boolean;
}

export class AuthSessionChangedError extends Error {
  constructor() {
    super("La sesión cambió. Vuelve a intentar la operación con tu cuenta actual.");
    this.name = "AuthSessionChangedError";
  }
}

type Listener = (change: AuthSessionChange) => void;
const listeners = new Set<Listener>();

function markerGeneration(): string | null {
  const marker = localStorage.getItem(AUTH_SESSION_STORAGE_KEY);
  if (marker === null) return null;
  try {
    const value: unknown = JSON.parse(marker);
    if (typeof value === "object" && value !== null
      && "generation" in value && typeof value.generation === "string") return value.generation;
  } catch { /* An invalid marker cannot restore legacy credentials. */ }
  return "invalid";
}

// Only an explicit login/logout replaces the marker. A late response writes
// exclusively to its own generation's pair, never over a newer account's pair.
export function getAuthSession(): AuthSessionSnapshot {
  const generation = markerGeneration();
  if (generation !== null) {
    if (localStorage.getItem(`${CLOSED_PREFIX}${generation}`) !== null) {
      return { generation: `closed:${generation}`, accessToken: null, refreshToken: null };
    }
    const record = localStorage.getItem(`${CREDENTIALS_PREFIX}${generation}`);
    if (record === null) return { generation, accessToken: null, refreshToken: null };
    try {
      const value: unknown = JSON.parse(record);
      if (typeof value === "object" && value !== null
        && "generation" in value && value.generation === generation
        && "accessToken" in value && (value.accessToken === null || typeof value.accessToken === "string")
        && "refreshToken" in value && (value.refreshToken === null || typeof value.refreshToken === "string")) {
        return value as AuthSessionSnapshot;
      }
    } catch {
      // A malformed record must not restore older credentials from other keys.
    }
    return { generation: `closed:${generation}`, accessToken: null, refreshToken: null };
  }
  const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
  return {
    generation: accessToken || refreshToken ? `legacy:${refreshToken || accessToken}` : "anonymous",
    accessToken,
    refreshToken,
  };
}

let observedSession = getAuthSession();

function announce(snapshot: AuthSessionSnapshot, external: boolean): void {
  const identityChanged = observedSession.generation !== snapshot.generation;
  const credentialsChanged = observedSession.accessToken !== snapshot.accessToken
    || observedSession.refreshToken !== snapshot.refreshToken;
  observedSession = snapshot;
  if (identityChanged || credentialsChanged) {
    listeners.forEach((listener) => listener({ snapshot, identityChanged, external }));
  }
}

function writeSession(snapshot: AuthSessionSnapshot): void {
  assertAuthSession(snapshot.generation);
  const key = `${CREDENTIALS_PREFIX}${snapshot.generation}`;
  localStorage.setItem(key, JSON.stringify(snapshot));
  try {
    assertAuthSession(snapshot.generation);
  } catch (error) {
    localStorage.removeItem(key);
    throw error;
  }
  // New credentials live only in their own pair. Legacy keys are read once
  // for old installations, never used as a second publication channel.
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  announce(snapshot, false);
}

function replaceIdentity(): string {
  const generation = newGeneration();
  localStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify({ generation }));
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  // Old pairs contain credentials and must not remain after account changes.
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith(CREDENTIALS_PREFIX)
      && key !== `${CREDENTIALS_PREFIX}${markerGeneration()}`
      && key !== `${CLOSED_PREFIX}${markerGeneration()}`) localStorage.removeItem(key);
  }
  announce({ generation, accessToken: null, refreshToken: null }, false);
  return generation;
}

function newGeneration(): string {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
}

export function beginAuthSession(): string {
  return replaceIdentity();
}

export function assertAuthSession(generation: string): AuthSessionSnapshot {
  const current = getAuthSession();
  if (current.generation !== generation) throw new AuthSessionChangedError();
  return current;
}

export function completeAuthSession(generation: string, access: string, refresh: string): void {
  assertAuthSession(generation);
  writeSession({ generation, accessToken: access, refreshToken: refresh });
}

export function rotateSessionTokens(
  expected: AuthSessionSnapshot,
  access: string,
  refresh: string,
): AuthSessionSnapshot {
  const current = assertAuthSession(expected.generation);
  if (current.refreshToken !== expected.refreshToken) throw new AuthSessionChangedError();
  const next = { generation: expected.generation, accessToken: access, refreshToken: refresh };
  writeSession(next);
  return next;
}

export function getAccessToken(): string | null {
  return getAuthSession().accessToken;
}

export function getRefreshToken(): string | null {
  return getAuthSession().refreshToken;
}

export function saveTokens(access: string, refresh?: string): void {
  const generation = replaceIdentity();
  writeSession({ generation, accessToken: access, refreshToken: refresh || null });
}

export function clearTokens(expectedGeneration?: string): boolean {
  if (expectedGeneration === undefined) {
    replaceIdentity();
    return true;
  }
  if (getAuthSession().generation !== expectedGeneration) return false;
  if (markerGeneration() === null) {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    announce(getAuthSession(), false);
    return true;
  }
  // Failure of an old request may close only its own generation. Never replace
  // the shared marker here: another tab can start a new login during cleanup.
  if (expectedGeneration.startsWith("closed:")) return false;
  // Keep this immutable tombstone separate from the pair. A refresh that
  // already passed its first check cannot overwrite the expiration flag.
  localStorage.setItem(`${CLOSED_PREFIX}${expectedGeneration}`, "1");
  localStorage.removeItem(`${CREDENTIALS_PREFIX}${expectedGeneration}`);
  if (markerGeneration() === expectedGeneration) {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    announce(getAuthSession(), false);
  }
  return true;
}

export function subscribeAuthSession(listener: Listener): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

window.addEventListener("storage", (event) => {
  if (event.storageArea !== null && event.storageArea !== localStorage) return;
  if (event.key === AUTH_SESSION_STORAGE_KEY || event.key?.startsWith(CREDENTIALS_PREFIX) || event.key === null
    || ((event.key === ACCESS_TOKEN_KEY || event.key === REFRESH_TOKEN_KEY)
      && localStorage.getItem(AUTH_SESSION_STORAGE_KEY) === null)) {
    announce(getAuthSession(), true);
  }
});
