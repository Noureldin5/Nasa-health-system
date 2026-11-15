import { useEffect } from "react";
import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { Shell } from "./components/Shell";
import { AppProvider } from "./lib/app";
import { Ask } from "./screens/Ask";
import { BriefComposer } from "./screens/BriefComposer";
import { Cabin } from "./screens/Cabin";
import { CheckIn } from "./screens/CheckIn";
import { Environment } from "./screens/Environment";
import { Consult } from "./screens/Consult";
import { Crew } from "./screens/ground/Crew";
import { Inbox } from "./screens/ground/Inbox";
import { GroundRecord } from "./screens/ground/Record";
import { Health } from "./screens/Health";
import { IndicatorDetail } from "./screens/IndicatorDetail";
import { Measure } from "./screens/Measure";
import { Readiness } from "./screens/Readiness";
import { Replay } from "./screens/Replay";
import { Today } from "./screens/Today";
import { WhatGroundSees } from "./screens/WhatGroundSees";

function ShellLayout() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return (
    <Shell>
      <Outlet />
    </Shell>
  );
}

export function App() {
  return (
    <AppProvider>
      <Routes>
        <Route path="/checkin" element={<CheckIn />} />
        <Route element={<ShellLayout />}>
          {/* Astronaut */}
          <Route index element={<Today />} />
          <Route path="/health" element={<Health />} />
          <Route path="/health/:metric" element={<IndicatorDetail />} />
          <Route path="/measure" element={<Measure />} />
          <Route path="/cabin" element={<Cabin />} />
          <Route path="/environment" element={<Environment />} />
          <Route path="/consult" element={<Consult />} />
          <Route path="/consult/new" element={<BriefComposer />} />
          <Route path="/consult/ground-view" element={<WhatGroundSees />} />
          <Route path="/readiness" element={<Readiness />} />
          <Route path="/ask" element={<Ask />} />
          <Route path="/replay" element={<Replay />} />
          {/* Ground (flight surgeon) */}
          <Route path="/ground" element={<Crew />} />
          <Route path="/ground/inbox" element={<Inbox />} />
          <Route path="/ground/crew/:id" element={<GroundRecord />} />
          <Route path="/ground/crew/:id/cabin" element={<Cabin />} />
          <Route path="/ground/crew/:id/replay" element={<Replay />} />
          <Route path="/ground/crew/:id/:metric" element={<IndicatorDetail />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </AppProvider>
  );
}
