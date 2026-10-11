import { createContext, useContext, useEffect, useState } from 'react';
import { VISAS } from './content.js';
import { cleanDates } from './dates.js';

const KEY = 'visalife.profile';
const Ctx = createContext(null);

export const EMPTY = { v: 1, nationality: 'IN', visa: null, stage: null, dates: {}, flags: {}, situations: [], checks: {}, dismissed: [], updatedAt: null };

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    return { ...EMPTY, ...p, dates: cleanDates(p?.dates, VISAS.fields) };
  } catch {
    return null;
  }
}

export function ProfileProvider({ children }) {
  const [profile, setProfile] = useState(load);
  useEffect(() => {
    try {
      if (profile) localStorage.setItem(KEY, JSON.stringify(profile));
      else localStorage.removeItem(KEY);
    } catch {
      /* private mode or storage blocked: the session still works in memory */
    }
  }, [profile]);
  const update = (patch) =>
    setProfile((p) => {
      const base = p ?? EMPTY;
      return { ...base, ...(typeof patch === 'function' ? patch(base) : patch), updatedAt: new Date().toISOString() };
    });
  const reset = () => setProfile(null);
  return <Ctx.Provider value={{ profile, update, reset }}>{children}</Ctx.Provider>;
}

export const useProfile = () => useContext(Ctx);
