import React, { useEffect, useRef, useState } from 'react';
import { ThemePreference, getThemePreference, setThemePreference } from '../theme';

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

const SettingsMenu: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<ThemePreference>(getThemePreference);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const chooseTheme = (pref: ThemePreference) => {
    setTheme(pref);
    setThemePreference(pref);
  };

  return (
    <div className="settings-menu" ref={rootRef}>
      <button
        className="settings-menu-button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="true"
        aria-expanded={open}
        title="Settings"
      >
        ⚙
      </button>
      {open && (
        <div className="settings-panel" role="dialog" aria-label="Settings">
          <div className="settings-panel-title">Settings</div>
          <div className="settings-row">
            <span className="settings-label" id="settings-theme-label">Appearance</span>
            <div className="segmented" role="radiogroup" aria-labelledby="settings-theme-label">
              {THEME_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  role="radio"
                  aria-checked={theme === opt.value}
                  className={theme === opt.value ? 'active' : ''}
                  onClick={() => chooseTheme(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <p className="settings-hint">Auto follows your system setting. Saved in this browser.</p>
        </div>
      )}
    </div>
  );
};

export default SettingsMenu;
