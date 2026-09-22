import { Routes, Route } from 'react-router-dom';
import GlassFilters from './components/GlassFilters.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import Home from './pages/Home.jsx';
import Login from './pages/Login.jsx';
import Signup from './pages/Signup.jsx';
import Dashboard from './pages/Dashboard.jsx';
import JobPosting from './pages/JobPosting.jsx';
import Results from './pages/Results.jsx';
import BulletImprove from './pages/BulletImprove.jsx';
import Download from './pages/Download.jsx';

function Protected({ children }) {
  return <ProtectedRoute>{children}</ProtectedRoute>;
}

export default function App() {
  return (
    <AuthProvider>
      <GlassFilters />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
        <Route path="/resumes/:resumeId/job-posting" element={<Protected><JobPosting /></Protected>} />
        <Route path="/results/:analysisId" element={<Protected><Results /></Protected>} />
        <Route path="/results/:analysisId/bullets/:bulletId" element={<Protected><BulletImprove /></Protected>} />
        <Route path="/results/:analysisId/download" element={<Protected><Download /></Protected>} />
      </Routes>
    </AuthProvider>
  );
}
