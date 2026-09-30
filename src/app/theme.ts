import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';

export type ThemePreference = 'system' | 'light' | 'dark';
export type ColorScheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'odata-explorer.theme';
const DARK_QUERY = '(prefers-color-scheme: dark)';

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'system' || value === 'light' || value === 'dark';
}

// localStorage throws when storage is blocked (e.g. cookies disabled); fall back to the OS setting.
function readPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return isThemePreference(stored) ? stored : 'system';
  } catch {
    return 'system';
  }
}

function writePreference(preference: ThemePreference) {
  try {
    if (preference === 'system') localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Not persisted; the choice still applies until reload.
  }
}

function subscribeToSystemScheme(onChange: () => void) {
  const query = window.matchMedia(DARK_QUERY);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

function getSystemScheme(): ColorScheme {
  return window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light';
}

/**
 * The user's theme choice, persisted in localStorage, and the color scheme it resolves to.
 * `system` follows the OS setting live.
 */
export function useTheme() {
  const [preference, setPreferenceState] = useState(readPreference);
  const systemScheme = useSyncExternalStore(subscribeToSystemScheme, getSystemScheme);
  const scheme: ColorScheme = preference === 'system' ? systemScheme : preference;

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    writePreference(next);
  }, []);

  // Native scrollbars and form controls follow the page's color-scheme.
  useEffect(() => {
    document.documentElement.style.colorScheme = scheme;
  }, [scheme]);

  return { preference, setPreference, scheme };
}
