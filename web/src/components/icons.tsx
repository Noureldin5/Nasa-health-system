import type { SVGProps } from "react";

/** Small hand-drawn icon set (24px grid, 1.75 stroke). Bundled, no icon font. */
export type IconName =
  | "today"
  | "body"
  | "cabin"
  | "consult"
  | "crew"
  | "inbox"
  | "check"
  | "close"
  | "chevron-right"
  | "chevron-left"
  | "sync"
  | "antenna"
  | "log"
  | "pin"
  | "flag"
  | "request"
  | "note"
  | "eye"
  | "plus"
  | "arrow-right"
  | "clock"
  | "info"
  | "reset";

const paths: Record<IconName, JSX.Element> = {
  today: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8" />
    </>
  ),
  body: (
    <>
      <circle cx="12" cy="4.5" r="2.2" />
      <path d="M6 8.5c4 1 8 1 12 0M12 9.3v5.2M12 14.5l-2.6 7M12 14.5l2.6 7" />
    </>
  ),
  cabin: (
    <>
      <path d="M3 8h11a3 3 0 1 0-3-3" />
      <path d="M3 12h15a3 3 0 1 1-3 3" />
      <path d="M3 16h7" />
    </>
  ),
  consult: (
    <>
      <path d="M4 5.5h16v10H9l-5 4v-14z" />
      <path d="M8 9.5h8M8 12.5h5" />
    </>
  ),
  crew: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 19c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5" />
      <circle cx="17" cy="9" r="2.3" />
      <path d="M16.2 14.2c2.4.2 3.9 1.8 4.3 4.3" />
    </>
  ),
  inbox: (
    <>
      <path d="M3.5 13.5l2.5-8h12l2.5 8v5h-17v-5z" />
      <path d="M3.5 13.5h5l1 2h5l1-2h5" />
    </>
  ),
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  "chevron-right": <path d="M9.5 6l6 6-6 6" />,
  "chevron-left": <path d="M14.5 6l-6 6 6 6" />,
  sync: (
    <>
      <path d="M19.5 8.5A8 8 0 0 0 5 7.3L3.5 9" />
      <path d="M3.5 4.5V9H8" />
      <path d="M4.5 15.5A8 8 0 0 0 19 16.7l1.5-1.7" />
      <path d="M20.5 19.5V15H16" />
    </>
  ),
  antenna: (
    <>
      <path d="M5 13a7 7 0 0 1 7-7M8.5 13a3.5 3.5 0 0 1 3.5-3.5" />
      <circle cx="12" cy="13" r="1.4" />
      <path d="M12 14.5L8 21h8l-4-6.5" />
    </>
  ),
  log: <path d="M8 6.5h12M8 12h12M8 17.5h12M4 6.5h.01M4 12h.01M4 17.5h.01" />,
  pin: (
    <>
      <path d="M9 4h6l-1 5 3 3H7l3-3-1-5z" />
      <path d="M12 12v8" />
    </>
  ),
  flag: (
    <>
      <path d="M6 21V4" />
      <path d="M6 4.5h11l-2 4 2 4H6" />
    </>
  ),
  request: (
    <>
      <rect x="5" y="4.5" width="14" height="16" rx="1.5" />
      <path d="M9 4.5V3h6v1.5M8.5 11h7M8.5 15h4.5" />
    </>
  ),
  note: (
    <>
      <path d="M5 4.5h14v11l-5 5H5v-16z" />
      <path d="M14 20.5v-5h5M8.5 9h7M8.5 12.5h4" />
    </>
  ),
  eye: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="2.8" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  "arrow-right": <path d="M4.5 12h15M13.5 6l6 6-6 6" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5.5M12 7.6v.01" />
    </>
  ),
  reset: (
    <>
      <path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3L4.5 9" />
      <path d="M4.5 4.5V9H9" />
    </>
  ),
};

export function Icon({ name, size = 20, ...rest }: { name: IconName; size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {paths[name]}
    </svg>
  );
}

/** App mark: a personal baseline band with a reading crossing it. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <rect x="1" y="1" width="30" height="30" rx="7" fill="#17171b" stroke="#444447" />
      <rect x="5" y="12.5" width="22" height="7" rx="1.5" fill="rgb(185 185 187 / 0.16)" />
      <path d="M5 17h5l2.5-6 3.5 11 3-7h8" fill="none" stroke="#47da84" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
