import type { ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";
import { api } from "../api/client";
import { DISCLAIMER } from "../content/sources";
import { ME, useApp, useQuery } from "../lib/app";
import { fmtTime } from "../lib/format";
import { BrandMark, Icon, type IconName } from "./icons";

interface NavItem {
  to: string;
  label: string;
  icon: IconName;
  end?: boolean;
  count?: number;
}

export function Shell({ children }: { children: ReactNode }) {
  const { role, mission, link, syncing, syncNow, bump, toast } = useApp();
  const me = useQuery(`shell-me`, () => api.getAstronautView(ME));
  const inbox = useQuery(`shell-inbox`, () => api.getInbox());

  const unreadReplies = me.data?.replies.filter((r) => !r.ack).length ?? 0;
  const openRequests = me.data?.requests.filter((r) => !r.doneAt).length ?? 0;
  const astronautNav: NavItem[] = [
    { to: "/", label: "Today", icon: "today", end: true },
    { to: "/health", label: "Body & vitals", icon: "body" },
    { to: "/cabin", label: "Cabin Link", icon: "cabin" },
    { to: "/environment", label: "Where you are", icon: "info" },
    { to: "/consult", label: "Consult", icon: "consult", count: unreadReplies + openRequests },
    { to: "/readiness", label: "Crew readiness", icon: "crew" },
  ];
  const groundNav: NavItem[] = [
    { to: "/ground", label: "Crew", icon: "crew", end: true },
    { to: "/ground/inbox", label: "Inbox", icon: "inbox", count: inbox.data?.length ?? 0 },
  ];
  const nav = role === "ground" ? groundNav : astronautNav;
  const pending = (link?.pendingToGround ?? 0) + (link?.pendingFromGround ?? 0);

  async function reset() {
    if (!api.resetDemo) return;
    if (!window.confirm("Reset the demo to the start of mission day 14? Your check-ins, briefs and notes from this session are cleared.")) return;
    await api.resetDemo();
    bump();
    toast("Demo reset to mission day 14, 09:40 GMT.");
  }

  return (
    <div className="app">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <header className="topbar">
        <Link to={role === "ground" ? "/ground" : "/"} className="brand" aria-label="Own Your Baseline, home">
          <BrandMark className="brand__mark" />
          <span className="brand__text">
            <span className="brand__name">Own Your Baseline</span>
            <span className="brand__sub">{role === "ground" ? "Ground · flight surgeon" : "Crew health · on board"}</span>
          </span>
        </Link>
        {mission && (
          <div className="mission" aria-label="Mission status">
            <div className="mission__item mission__item--hide-md">
              <b>{mission.name}</b>
              <span>Station</span>
            </div>
            <div className="mission__item">
              <b>Day {mission.day}</b>
              <span>Mission</span>
            </div>
            <div className="mission__item">
              <b>{fmtTime(mission.now)}</b>
              <span>GMT</span>
            </div>
          </div>
        )}
        <div className="topbar__spacer" />
        <div className="topbar__right">
          <nav className="role-switch" aria-label="Role">
            <NavLink to="/" className={() => (role === "astronaut" ? "is-active" : "")} aria-current={role === "astronaut" ? "page" : undefined}>
              <Icon name="body" size={16} />
              <span className="role-switch__label">Astronaut</span>
            </NavLink>
            <NavLink to="/ground" className={() => (role === "ground" ? "is-active" : "")} aria-current={role === "ground" ? "page" : undefined}>
              <Icon name="antenna" size={16} />
              <span className="role-switch__label">Ground</span>
            </NavLink>
          </nav>
          {link && (
            <div
              className={`link-chip${syncing ? " link-chip--busy" : ""}`}
              title={`Simulated ground link. Sync now opens a link window. Signal delay about ${link.oneWayDelaySec} s each way (demo parameter).`}
            >
              {syncing ? (
                <>
                  <span className="link-progress" aria-hidden="true" />
                  <span className="link-chip__text" aria-live="polite">
                    Link open · ↑{link.pendingToGround} ↓{link.pendingFromGround}
                  </span>
                </>
              ) : (
                <>
                  <span className={`link-chip__dot${pending ? " link-chip__dot--pending" : ""}`} aria-hidden="true" />
                  <span className="link-chip__text">
                    Last sync {fmtTime(link.lastSync)}
                    {pending ? ` · ${pending} queued` : ""}
                  </span>
                </>
              )}
              <button type="button" className="btn btn--secondary" onClick={syncNow} disabled={syncing} aria-label={`Sync now. ${pending} items queued.`}>
                <Icon name="sync" size={14} />
                {syncing ? "Syncing" : "Sync now"}
              </button>
            </div>
          )}
          <span className="tag" title="All data in this demo is simulated except the NASA OSD-569 reference">
            <span className="hide-sm">Simulated data</span>
            <span className="show-sm">Sim</span>
          </span>
        </div>
      </header>

      <div className="app__body">
        <nav className="rail" aria-label="Main">
          <span className="micro rail__label">{role === "ground" ? "Flight surgeon" : "Astronaut"}</span>
          {nav.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className="nav-link">
              <Icon name={n.icon} />
              {n.label}
              {n.count ? (
                <span className="nav-link__count" aria-label={`${n.count} new`}>
                  {n.count}
                </span>
              ) : null}
            </NavLink>
          ))}
          <div className="rail__foot">
            {role === "ground" ? (
              <div className="whoami">
                <span className="avatar">ER</span>
                <span className="small">
                  <span className="strong">Dr. Elena Ruiz</span>
                  <br />
                  <span className="muted">Flight surgeon</span>
                </span>
              </div>
            ) : (
              <div className="whoami">
                <span className="avatar">{me.data?.crew.initials ?? "…"}</span>
                <span className="small">
                  <span className="strong">{me.data?.crew.name ?? "Astronaut"}</span>
                  <br />
                  <span className="muted">{me.data?.crew.role ?? ""}</span>
                </span>
              </div>
            )}
            <p className="small muted">
              {role === "ground"
                ? "Everything you write here appears in the astronaut's app, word for word."
                : "Your flight surgeon sees the same record you do. You see everything they write."}
            </p>
          </div>
        </nav>

        <main id="main" className="main" tabIndex={-1}>
          {children}
        </main>
      </div>

      <footer className="footer">
        <span className="footer__disclaimer">{DISCLAIMER}</span>
        <span>Simulated data is labeled. NASA reference: OSDR OSD-569.</span>
        <span>{api.mode === "mock" ? "Mock API: runs in the browser, no backend" : "Connected to the station API"}</span>
        {api.resetDemo && (
          <button type="button" onClick={reset}>
            Reset demo data
          </button>
        )}
      </footer>

      <nav className="tabbar" aria-label="Main">
        {nav.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end}>
            <Icon name={n.icon} size={22} />
            {n.label.replace("Body & vitals", "Body").replace("Crew readiness", "Crew")}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
