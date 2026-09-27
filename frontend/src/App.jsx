import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { UIProvider } from './lib/ui.jsx';
import Home from './pages/Home.jsx';
import Auth from './pages/Auth.jsx';
import Dashboard from './pages/Dashboard.jsx';
import JobPosting from './pages/JobPosting.jsx';
import Results from './pages/Results.jsx';
import BulletImprove from './pages/BulletImprove.jsx';
import Download from './pages/Download.jsx';
import Done from './pages/Done.jsx';
import Settings from './pages/Settings.jsx';
import Styleguide from './pages/Styleguide.jsx';
import Latest from './pages/Latest.jsx';

// New page → start at the top (in-page #anchors still scroll to their section).
function ScrollToTop() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView();
    else window.scrollTo(0, 0);
  }, [pathname, hash]);
  return null;
}

const P = ({ children }) => <ProtectedRoute>{children}</ProtectedRoute>;

export default function App() {
  return (
    <AuthProvider>
      <UIProvider>
        <ScrollToTop />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Auth mode="login" />} />
          <Route path="/signup" element={<Auth mode="signup" />} />
          <Route path="/styleguide" element={<Styleguide />} />
          <Route path="/dashboard" element={<P><Dashboard /></P>} />
          <Route path="/job" element={<P><JobPosting /></P>} />
          <Route path="/results/:analysisId" element={<P><Results /></P>} />
          <Route path="/results/:analysisId/improve" element={<P><BulletImprove /></P>} />
          <Route path="/results/:analysisId/export" element={<P><Download /></P>} />
          <Route path="/results/:analysisId/done" element={<P><Done /></P>} />
          <Route path="/settings" element={<P><Settings /></P>} />
          <Route path="/latest/:screen" element={<P><Latest /></P>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </UIProvider>
    </AuthProvider>
  );
}
