import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppShell from '../components/AppShell.jsx';
import { api } from '../api.js';

function formatSize(bytes) {
  if (!bytes) return '';
  const kb = bytes / 1024;
  return kb < 1024 ? `${Math.round(kb)} KB` : `${(kb / 1024).toFixed(1)} MB`;
}
function formatDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

// Screen 2: Resume Upload Dashboard
export default function Dashboard() {
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const [resumes, setResumes] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState('');

  const refresh = () => api.listResumes().then((d) => setResumes(d.resumes));
  useEffect(() => {
    refresh();
  }, []);

  const handleFile = async (file) => {
    if (!file) return;
    setError('');
    if (!/\.(pdf|docx)$/i.test(file.name)) {
      setError('Only PDF or DOCX files are supported.'); // Screen 2: format warning
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('That file is over the 10MB limit.');
      return;
    }
    setProgress(0);
    try {
      await api.uploadResumeWithProgress(file, setProgress);
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setProgress(null);
    }
  };

  const handleDelete = async (id) => {
    await api.deleteResume(id);
    refresh();
  };

  return (
    <AppShell>
      <main style={{ maxWidth: 720, margin: '0 auto', padding: '56px 24px 96px' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 34, fontWeight: 600, margin: '0 0 8px', color: 'var(--ink)' }}>
          Your resumes
        </h1>
        <p style={{ fontSize: 17, color: 'var(--ink2)', margin: '0 0 32px' }}>
          Upload a resume, then match it against a job posting to see your ATS score.
        </p>

        {error ? (
          <div style={{ background: 'rgba(224,82,82,.08)', color: 'var(--error)', fontSize: 14, padding: '10px 14px', borderRadius: 12, marginBottom: 16 }}>
            {error}
          </div>
        ) : null}

        <div
          className="lg-card"
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            handleFile(e.dataTransfer.files?.[0]);
          }}
          style={{
            borderRadius: 18,
            padding: '40px 32px',
            textAlign: 'center',
            marginBottom: 32,
            outline: dragging ? '2px solid var(--primary)' : 'none',
            outlineOffset: 4,
          }}
        >
          <div style={{ width: 48, height: 48, margin: '0 auto 14px', borderRadius: 9999, background: 'var(--chip)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 15, height: 15, borderLeft: '2px solid var(--ink)', borderTop: '2px solid var(--ink)', transform: 'rotate(45deg)', marginTop: 5 }} />
          </div>
          <div style={{ fontSize: 17, fontWeight: 600, marginBottom: 4, color: 'var(--ink)' }}>Drag &amp; drop your resume</div>
          <div style={{ fontSize: 13, color: 'var(--ink3)', marginBottom: 16 }}>PDF or DOCX only, up to 10MB</div>

          {progress !== null ? (
            <div style={{ maxWidth: 240, margin: '0 auto' }}>
              <div style={{ height: 6, borderRadius: 3, background: 'var(--hairline)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${progress}%`, background: 'var(--primary)', transition: 'width .15s ease' }} />
              </div>
              <div style={{ fontSize: 12, color: 'var(--ink3)', marginTop: 6 }}>Uploading… {progress}%</div>
            </div>
          ) : (
            <>
              <input
                ref={inputRef}
                type="file"
                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                style={{ display: 'none' }}
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
              <button className="btn-outline" style={{ padding: '9px 18px', fontSize: 14 }} onClick={() => inputRef.current?.click()}>
                Browse Files
              </button>
            </>
          )}
        </div>

        <h2 style={{ fontSize: 14, fontWeight: 600, letterSpacing: -0.224, color: 'var(--ink3)', margin: '0 0 14px' }}>
          {resumes?.length ? 'Uploaded resumes' : ''}
        </h2>
        {resumes === null ? null : resumes.length === 0 ? (
          <p style={{ fontSize: 14, color: 'var(--ink3)' }}>No resumes uploaded yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {resumes.map((r) => (
              <div
                key={r.id}
                style={{
                  border: '1px solid var(--hairline)',
                  borderRadius: 16,
                  padding: 18,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  background: 'var(--canvas)',
                }}
              >
                <div style={{ width: 36, height: 36, borderRadius: 9999, background: 'var(--chip)', flex: 'none' }} />
                <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => navigate(`/resumes/${r.id}/job-posting`)}>
                  <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)' }}>{r.filename}</div>
                  <div style={{ fontSize: 13, color: 'var(--ink3)' }}>
                    {formatSize(r.sizeBytes)} · Uploaded {formatDate(r.createdAt)}
                    {r.parseError ? <span style={{ color: 'var(--warning)' }}> · Couldn't fully parse structure</span> : null}
                  </div>
                </div>
                <button
                  className="btn-primary"
                  style={{ padding: '8px 16px', fontSize: 13 }}
                  onClick={() => navigate(`/resumes/${r.id}/job-posting`)}
                >
                  Match to a Job
                </button>
                <a
                  onClick={() => handleDelete(r.id)}
                  style={{ fontSize: 13, color: 'var(--ink3)', cursor: 'pointer', textDecoration: 'none' }}
                  title="Delete resume"
                >
                  Delete
                </a>
              </div>
            ))}
          </div>
        )}
      </main>
    </AppShell>
  );
}
