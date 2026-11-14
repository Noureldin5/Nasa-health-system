import { Link, useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import { Icon } from "../../components/icons";
import { StatusPill } from "../../components/status";
import { ErrorNote, PageHead } from "../../components/ui";
import { useApp, useQuery } from "../../lib/app";
import { fmtDayTime } from "../../lib/format";

/** Crew list (U6): one row per astronaut, status, alerts, briefs, last sync. */
export function Crew() {
  const nav = useNavigate();
  const { mission } = useApp();
  const crew = useQuery("crew", () => api.getCrew());
  const inbox = useQuery("inbox", () => api.getInbox());

  return (
    <div className="stack" style={{ ["--gap" as string]: "var(--s-5)" }}>
      <ErrorNote error={crew.error} />
      <PageHead title="Crew" sub="Status per astronaut, as of the last ground link. Open a record when something needs context." />
      {mission && crew.data && (
        <div className="banner">
          <Icon name="antenna" size={18} />
          <span>
            <b>Last sync: {fmtDayTime(crew.data[0]?.lastSync ?? mission.now, mission)} GMT.</b> Ground data is as of then, not live. Press Sync now in the top bar to open a link window.
          </span>
        </div>
      )}
      <section className="card table-x" aria-label="Crew list">
        <table className="crew-table">
          <thead>
            <tr>
              <th>Astronaut</th>
              <th>Status</th>
              <th className="num hide-sm">Open alerts</th>
              <th className="num">Questions</th>
              <th className="hide-sm">Last sync</th>
              <th className="hide-sm" aria-label="Open" />
            </tr>
          </thead>
          <tbody>
            {crew.data?.map((c) => (
              <tr key={c.id} onClick={() => nav(`/ground/crew/${c.id}`)}>
                <td>
                  <div className="row" style={{ flexWrap: "nowrap" }}>
                    <span className="avatar">{c.initials}</span>
                    <span>
                      <Link to={`/ground/crew/${c.id}`} className="strong" style={{ color: "var(--c-text-strong)", textDecoration: "none" }}>
                        {c.name}
                      </Link>
                      <br />
                      <span className="small muted">{c.role}</span>
                    </span>
                  </div>
                </td>
                <td>
                  <StatusPill status={c.status} label={c.statusText} />
                </td>
                <td className="num mono hide-sm">{c.openAlerts}</td>
                <td className="num mono">{c.unansweredBriefs ? <span className="nav-link__count">{c.unansweredBriefs}</span> : 0}</td>
                <td className="hide-sm mono small">{mission ? fmtDayTime(c.lastSync, mission) : ""}</td>
                <td className="hide-sm" style={{ width: 40 }}>
                  <Icon name="chevron-right" size={18} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <div className="row row--between">
        <p className="text-2">
          {inbox.data?.length ? `${inbox.data.length} item${inbox.data.length > 1 ? "s" : ""} in the inbox.` : "Inbox empty. Normal days need no action."}
        </p>
        <Link to="/ground/inbox" className="btn btn--primary btn--lg">
          <Icon name="inbox" size={18} /> Open inbox
        </Link>
      </div>
    </div>
  );
}
