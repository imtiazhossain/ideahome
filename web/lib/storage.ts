export function safeSessionStorageGet(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

export function safeSessionStorageSet(key: string, value: string): void {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // ignore storage restrictions
  }
}

export function safeSessionStorageRemove(key: string): void {
  try {
    sessionStorage.removeItem(key);
  } catch {
    // ignore storage restrictions
  }
}

export function safeLocalStorageGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function safeLocalStorageSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore storage restrictions
  }
}

export function safeLocalStorageRemove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore storage restrictions
  }
}

export function safeLocalStorageGetJson<T>(
  key: string,
  validate: (value: unknown) => value is T
): T | null {
  const raw = safeLocalStorageGet(key);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return validate(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function safeLocalStorageSetJson<T>(key: string, value: T): void {
  try {
    safeLocalStorageSet(key, JSON.stringify(value));
  } catch {
    // ignore serialization/storage issues
  }
}
