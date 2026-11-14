import { Link } from "react-router-dom";
import type { Flag, Indicator, Mission } from "../api/types";
import { INDICATORS } from "../content/indicators";
import { fmtPoint, fmtUsual } from "../lib/format";
import { missionWindow } from "../lib/mission";
import { Sparkline } from "./charts";
import { Icon } from "./icons";
import { StatusPill } from "./status";
import { SourceTag } from "./ui";

export function IndicatorCard({ ind, mission, to, flag }: { ind: Indicator; mission: Mission; to: string; flag?: Flag }) {
  const c = INDICATORS[ind.key];
  const win = missionWindow(mission);
  const usual = fmtUsual(ind);
  const pts = ind.series.map((p) => ({ t: Date.parse(p.t), v: p.v, v2: p.v2 }));
  const b = ind.baseline;

  return (
    <Link to={to} className={`ind ind--${ind.status}`} aria-label={`${c.label}: ${fmtPoint(ind.key, ind.latest)} ${c.unit}, ${ind.statusText}. Open details.`}>
      <div className="ind__top">
        <div>
          <div className="ind__name">{c.label}</div>
          <div className="ind__cadence">{c.cadenceText}</div>
        </div>
        <StatusPill status={ind.status} />
      </div>
      <div className="ind__value">
        <b>{fmtPoint(ind.key, ind.latest)}</b>
        <span>{c.unit}</span>
      </div>
      <Sparkline
        points={pts}
        xDomain={win.domain}
        status={ind.status}
        range={ind.key === "bp"}
        band={b.state === "ready" ? { low: b.low, high: b.high } : null}
        band2={b.state === "ready" && b.low2 != null ? { low: b.low2, high: b.high2! } : null}
      />
      <div className="ind__usual">
        {usual ? (
          <span>
            Your usual <span className="num">{usual}</span>
          </span>
        ) : (
          <span>Learning your usual range</span>
        )}
        <SourceTag source={ind.source} />
      </div>
      <div className="ind__status">
        <span>{ind.statusText}</span>
        {flag ? (
          <span className="ind__flag">
            <Icon name="flag" size={14} /> Watched by ground
          </span>
        ) : (
          <Icon name="chevron-right" size={16} />
        )}
      </div>
    </Link>
  );
}
