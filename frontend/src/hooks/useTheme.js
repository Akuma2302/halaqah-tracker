import { useCallback, useEffect, useState } from 'react';

// Pairs with the inline script in index.html, which sets <html data-theme>
// before first paint. With no saved choice, the theme follows the system.
const STORAGE_KEY = 'mutabaah_theme';
const THEME_COLORS = { light: '#0f6e56', dark: '#0f1716' };

function readSaved() {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    return null;
  }
}

function apply(theme) {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[theme]);
}

export function useTheme() {
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || 'light');

  useEffect(() => {
    apply(theme);
  }, [theme]);

  useEffect(() => {
    if (readSaved() || !window.matchMedia) return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e) => !readSaved() && setTheme(e.matches ? 'dark' : 'light');
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((current) => {
      const next = current === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // Private mode etc. — the toggle still works for this visit.
      }
      return next;
    });
  }, []);

  return { theme, toggleTheme };
}
