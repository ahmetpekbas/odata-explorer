import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { stubSystemScheme } from '../test/matchMedia.ts';
import { THEME_STORAGE_KEY, useTheme } from './theme.ts';

describe('useTheme', () => {
  it('follows the OS setting by default, including live changes', () => {
    const system = stubSystemScheme('dark');
    const { result } = renderHook(() => useTheme());
    expect(result.current.preference).toBe('system');
    expect(result.current.scheme).toBe('dark');

    act(() => system.set('light'));
    expect(result.current.scheme).toBe('light');
    expect(document.documentElement.style.colorScheme).toBe('light');
  });

  it('lets a manual choice override the OS and persists it', () => {
    stubSystemScheme('dark');
    const { result } = renderHook(() => useTheme());

    act(() => result.current.setPreference('light'));
    expect(result.current.scheme).toBe('light');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
  });

  it('restores the saved choice on the next load', () => {
    stubSystemScheme('light');
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    const { result } = renderHook(() => useTheme());
    expect(result.current.preference).toBe('dark');
    expect(result.current.scheme).toBe('dark');
  });

  it('forgets the saved choice when switching back to system', () => {
    stubSystemScheme('light');
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    const { result } = renderHook(() => useTheme());

    act(() => result.current.setPreference('system'));
    expect(result.current.scheme).toBe('light');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
  });

  it('ignores an unrecognized saved value', () => {
    stubSystemScheme('dark');
    localStorage.setItem(THEME_STORAGE_KEY, 'sepia');
    const { result } = renderHook(() => useTheme());
    expect(result.current.preference).toBe('system');
    expect(result.current.scheme).toBe('dark');
  });
});
