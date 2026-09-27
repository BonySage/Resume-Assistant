import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';

// /latest/:screen → the same screen for the user's most recent analysis (or the job step if there is none).
export default function Latest() {
  const { screen } = useParams();
  const navigate = useNavigate();
  useEffect(() => {
    api.listAnalyses()
      .then(({ analyses }) => {
        const a = analyses[0];
        if (!a) return navigate('/job', { replace: true });
        const suffix = { results: '', improve: '/improve', export: '/export', done: '/done' }[screen] ?? '';
        navigate(`/results/${a.id}${suffix}`, { replace: true });
      })
      .catch(() => navigate('/dashboard', { replace: true }));
  }, [screen, navigate]);
  return null;
}
