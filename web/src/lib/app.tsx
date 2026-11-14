import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { api } from "../api/client";
import type { LinkState, Mission } from "../api/types";

/** The astronaut using this device. One crew tablet per person in the story. */
export const ME = "a1";

interface Toast {
  id: number;
  text: string;
}

interface AppState {
  role: "astronaut" | "ground";
  /** Increments after every write so all screens refetch. */
  version: number;
  bump: () => void;
  toast: (text: string) => void;
  mission: Mission | null;
  link: LinkState | null;
  syncing: boolean;
  syncNow: () => Promise<void>;
}

const Ctx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const role = pathname.startsWith("/ground") ? "ground" : "astronaut";
  const [version, setVersion] = useState(0);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [mission, setMission] = useState<Mission | null>(null);
  const [link, setLink] = useState<LinkState | null>(null);
  const [syncing, setSyncing] = useState(false);
  const toastId = useRef(0);

  const bump = useCallback(() => setVersion((v) => v + 1), []);
  const toast = useCallback((text: string) => {
    const id = ++toastId.current;
    setToasts((t) => [...t, { id, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5200);
  }, []);

  useEffect(() => {
    let alive = true;
    Promise.all([api.getMission(), api.getLink()]).then(([m, l]) => {
      if (!alive) return;
      setMission(m);
      setLink(l);
    });
    return () => {
      alive = false;
    };
  }, [version]);

  // Keep the mission clock ticking between fetches.
  useEffect(() => {
    const id = setInterval(() => {
      setMission((m) => (m ? { ...m, now: new Date(Date.parse(m.now) + 15_000).toISOString() } : m));
    }, 15_000);
    return () => clearInterval(id);
  }, []);

  const syncNow = useCallback(async () => {
    setSyncing(true);
    try {
      // The link window stays visibly open for the simulated signal delay (demo parameter).
      const delayMs = Math.min(Math.max((link?.oneWayDelaySec ?? 1) * 600, 900), 2400);
      const [entry] = await Promise.all([api.syncNow(), new Promise((r) => setTimeout(r, delayMs))]);
      const up = entry.toGround.length;
      const down = entry.fromGround.length;
      toast(`Ground link: sent ${up} item${up === 1 ? "" : "s"}, received ${down}. Logged in the sync log.`);
      bump();
    } catch (e) {
      toast(`Sync failed: ${(e as Error).message}`);
    } finally {
      setSyncing(false);
    }
  }, [bump, toast, link]);

  const value = useMemo(
    () => ({ role, version, bump, toast, mission, link, syncing, syncNow }) satisfies AppState,
    [role, version, bump, toast, mission, link, syncing, syncNow],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="toast">
            {t.text}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp outside AppProvider");
  return v;
}

/**
 * Tiny data hook. Refetches when `key` or the global version changes and keeps
 * the previous data while reloading (no skeleton flash).
 */
export function useQuery<T>(key: string, fn: () => Promise<T>) {
  const { version } = useApp();
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fnRef
      .current()
      .then((d) => {
        if (!alive) return;
        setData(d);
        setError(null);
      })
      .catch((e: Error) => alive && setError(e))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [key, version]);

  return { data, error, loading };
}

/** Wrap a write: run it, refresh every screen, report errors as a toast. */
export function useAction() {
  const { bump, toast } = useApp();
  const [busy, setBusy] = useState(false);
  const run = useCallback(
    async <T,>(fn: () => Promise<T>, success?: string): Promise<T | undefined> => {
      setBusy(true);
      try {
        const out = await fn();
        bump();
        if (success) toast(success);
        return out;
      } catch (e) {
        toast(`Something went wrong: ${(e as Error).message}`);
        return undefined;
      } finally {
        setBusy(false);
      }
    },
    [bump, toast],
  );
  return { run, busy };
}
