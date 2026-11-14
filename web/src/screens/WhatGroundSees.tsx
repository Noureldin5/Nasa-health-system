import { Link } from "react-router-dom";
import { api } from "../api/client";
import type { RecordView } from "../api/types";
import { Icon } from "../components/icons";
import { ErrorNote, PageHead } from "../components/ui";
import { ME, useQuery } from "../lib/app";
import { fmtDayTime } from "../lib/format";
import { RecordBody } from "./ground/Record";

/**
 * "What ground sees" (D4): the flight surgeon's screen for this astronaut,
 * rendered with the same component from the same record. The only filter:
 * ground items still on their way up (written after the last link) are not on
 * the station yet, so they show after the next sync.
 */
export function WhatGroundSees() {
  const ground = useQuery(`ground-${ME}`, () => api.getGroundView(ME));
  const g = ground.data;

  const mirror: RecordView | undefined = g && {
    ...g,
    replies: g.replies.filter((x) => x.deliveredAt),
    notes: g.notes.filter((x) => x.deliveredAt),
    flags: g.flags.filter((x) => x.deliveredAt),
    requests: g.requests.filter((x) => x.deliveredAt),
  };

  return (
    <div className="stack" style={{ ["--gap" as string]: "var(--s-5)" }}>
      <ErrorNote error={ground.error} />
      <PageHead
        crumb={
          <Link to="/consult" className="crumb">
            <Icon name="chevron-left" size={16} /> Consult
          </Link>
        }
        title="What ground sees"
        sub="This is your flight surgeon's screen about you, built from the same record. Same data, same notes, same wording."
      />
      {mirror && (
        <>
          <div className="banner">
            <Icon name="antenna" size={18} />
            <span>
              Ground's copy is <b>as of the last sync, {fmtDayTime(mirror.asOf, mirror.mission)} GMT</b>. Anything you added after that goes up at the next link. There is no ground-only field.
            </span>
          </div>
          <RecordBody rec={mirror} readOnly metricHref={(m) => `/health/${m}`} />
        </>
      )}
      {!mirror && <div className="loading" style={{ minHeight: 600 }} aria-busy="true" />}
    </div>
  );
}
