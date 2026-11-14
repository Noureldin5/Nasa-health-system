import { Link } from "react-router-dom";
import { api } from "../../api/client";
import { Icon } from "../../components/icons";
import { AlertCard, BriefCard } from "../../components/record";
import { Empty, ErrorNote, PageHead } from "../../components/ui";
import { useApp, useQuery } from "../../lib/app";

/** Inbox (U6): briefs first, question on top and pinned items under it, then alerts since the last sync. */
export function Inbox() {
  const { mission } = useApp();
  const inbox = useQuery("inbox", () => api.getInbox());
  const items = inbox.data ?? [];
  const briefs = items.filter((i) => i.kind === "brief");
  const alerts = items.filter((i) => i.kind === "alert");

  return (
    <div className="stack" style={{ ["--gap" as string]: "var(--s-6)" }}>
      <ErrorNote error={inbox.error} />
      <PageHead title="Inbox" sub="Questions from the crew first, then alerts raised since the last sync." />
      {mission && inbox.data && !items.length && <Empty>Inbox empty. No questions, no new alerts. Normal days need no action.</Empty>}

      {mission && briefs.length > 0 && (
        <section className="section" aria-labelledby="ib-briefs">
          <h2 id="ib-briefs">Questions</h2>
          {briefs.map((i) => (
            <BriefCard key={i.brief!.id} brief={i.brief!} mission={mission} perspective="ground">
              <div className="row row--between">
                <span className="row small text-2">
                  <span className="avatar">{i.crew.initials}</span>
                  {i.crew.name}, {i.crew.role}
                </span>
                <Link to={`/ground/crew/${i.crew.id}`} className="btn btn--primary btn--lg">
                  Open record and reply <Icon name="arrow-right" size={18} />
                </Link>
              </div>
            </BriefCard>
          ))}
        </section>
      )}

      {mission && alerts.length > 0 && (
        <section className="section" aria-labelledby="ib-alerts">
          <h2 id="ib-alerts">Alerts</h2>
          {alerts.map((i) => (
            <div key={i.alert!.id} className="stack" style={{ ["--gap" as string]: "8px" }}>
              <span className="row small text-2">
                <span className="avatar">{i.crew.initials}</span>
                {i.crew.name}
              </span>
              <AlertCard
                alert={i.alert!}
                mission={mission}
                perspective="ground"
                actions={
                  <Link to={`/ground/crew/${i.crew.id}`} className="btn btn--secondary btn--lg">
                    Open record
                  </Link>
                }
              />
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
