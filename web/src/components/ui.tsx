import type { ReactNode } from "react";
import type { Source } from "../api/types";
import { sourceLabel } from "../lib/format";

export function Micro({ children, as: As = "span", className = "" }: { children: ReactNode; as?: "span" | "p" | "h2" | "h3" | "div"; className?: string }) {
  return <As className={`micro ${className}`}>{children}</As>;
}

export function SourceTag({ source, title }: { source: Source; title?: string }) {
  if (source === "checkin" || source === "manual") return <span className="tag" title={title}>{sourceLabel(source)}</span>;
  return (
    <span className={`tag${source === "nasa" ? " tag--nasa" : ""}`} title={title ?? (source === "sim" ? "Simulated data for the demo" : undefined)}>
      {sourceLabel(source)}
    </span>
  );
}

export function DemoTag({ title }: { title?: string }) {
  return (
    <span className="tag tag--demo" title={title ?? "Demo parameter: needs a cited source before real use"}>
      Demo parameter
    </span>
  );
}

export function Card({ title, micro, actions, children, className = "", bodyClass = "card__body", id }: {
  title?: ReactNode;
  micro?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClass?: string;
  id?: string;
}) {
  return (
    <section className={`card ${className}`} id={id} aria-label={typeof title === "string" ? title : undefined}>
      {(title || micro || actions) && (
        <header className="card__head">
          <div className="stack" style={{ ["--gap" as string]: "2px" }}>
            {micro && <span className="micro">{micro}</span>}
            {title && <h2 style={{ fontSize: "var(--fs-h3)" }}>{title}</h2>}
          </div>
          {actions && <div className="row">{actions}</div>}
        </header>
      )}
      <div className={bodyClass}>{children}</div>
    </section>
  );
}

export function PageHead({ title, sub, actions, crumb }: { title: ReactNode; sub?: ReactNode; actions?: ReactNode; crumb?: ReactNode }) {
  return (
    <div className="page-head">
      <div className="page-head__title">
        {crumb}
        <h1>{title}</h1>
        {sub && <p className="text-2">{sub}</p>}
      </div>
      {actions && <div className="row">{actions}</div>}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}

export function ErrorNote({ error }: { error: Error | null }) {
  if (!error) return null;
  return (
    <div className="banner banner--plain" role="alert">
      Could not load this view: {error.message}
    </div>
  );
}
