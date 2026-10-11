import { useLayoutEffect } from 'react';
import { createBrowserRouter, createRoutesFromElements, Route, RouterProvider, Navigate, Outlet, useLocation } from 'react-router-dom';
import { ProfileProvider, useProfile } from './lib/profile.jsx';
import BottomTabs from './components/BottomTabs.jsx';
import Onboarding from './pages/Onboarding.jsx';
import Home from './pages/Home.jsx';
import Journey from './pages/Journey.jsx';
import Policy from './pages/Policy.jsx';
import Me from './pages/Me.jsx';

function Shell() {
  const { profile } = useProfile();
  const { pathname } = useLocation();
  // A new tab starts at its top, not wherever the last one was scrolled to.
  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  if (!profile?.visa || !profile?.stage) return <Navigate to="/start" replace />;
  return (
    <div className="app">
      <main className="screen">
        <Outlet />
        <p className="disclaimer">General information from official sources, not legal advice. Confirm with the linked source or a licensed attorney.</p>
      </main>
      <BottomTabs />
    </div>
  );
}

// A data router: <NavLink viewTransition> (the cross-fade between tabs) is ignored by <BrowserRouter>.
const router = createBrowserRouter(
  createRoutesFromElements(
    <>
      <Route path="/start" element={<Onboarding />} />
      <Route element={<Shell />}>
        <Route path="/home" element={<Home />} />
        <Route path="/journey" element={<Journey />} />
        <Route path="/policy" element={<Policy />} />
        <Route path="/me" element={<Me />} />
      </Route>
      <Route path="*" element={<Navigate to="/home" replace />} />
    </>,
  ),
);

export default function App() {
  return (
    <ProfileProvider>
      <RouterProvider router={router} />
    </ProfileProvider>
  );
}
