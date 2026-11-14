import { Link } from "react-router-dom";
import { api } from "../api/client";
import { Dashboard } from "../components/Dashboard";
import { Icon } from "../components/icons";
import { ErrorNote, PageHead } from "../components/ui";
import { ME, useQuery } from "../lib/app";

export function Health() {
  const rec = useQuery(`astro-${ME}`, () => api.getAstronautView(ME));
  return (
    <>
      <PageHead
        title="Body & vitals"
        sub="Your record, compared with your own baseline. Your flight surgeon sees this same picture."
        actions={
          <Link to="/consult/ground-view" className="btn btn--secondary">
            <Icon name="eye" size={18} /> What ground sees
          </Link>
        }
      />
      <ErrorNote error={rec.error} />
      {rec.data ? <Dashboard rec={rec.data} metricHref={(m) => `/health/${m}`} canLog /> : <div className="loading" style={{ minHeight: 600 }} aria-busy="true" />}
    </>
  );
}
