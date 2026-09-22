const BASE = '/api';

let sessionExpiredHandler = null;
export function onSessionExpired(handler) {
  sessionExpiredHandler = handler;
}

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: options.body instanceof FormData ? undefined : { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    let code;
    let extra = {};
    try {
      const data = await res.json();
      if (data?.error) message = data.error;
      code = data?.code;
      extra = data;
    } catch {
      // ignore non-JSON error bodies
    }
    if (code === 'SESSION_EXPIRED') sessionExpiredHandler?.(message);
    const err = new Error(message);
    err.code = code;
    Object.assign(err, extra);
    throw err;
  }
  if (res.status === 204) return null;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) return res.json();
  return res;
}

export const api = {
  me: () => request('/auth/me'),
  signup: (body) => request('/auth/signup', { method: 'POST', body: JSON.stringify(body) }),
  login: (body) => request('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  logout: () => request('/auth/logout', { method: 'POST' }),

  // Resumes (Screen 2)
  listResumes: () => request('/resumes'),
  getResume: (id) => request(`/resumes/${id}`),
  uploadResume: (file) => {
    const form = new FormData();
    form.append('file', file);
    return request('/resumes', { method: 'POST', body: form });
  },
  // XHR (not fetch) so we get real upload progress events for Screen 2's progress indicator.
  uploadResumeWithProgress: (file, onProgress) =>
    new Promise((resolve, reject) => {
      const form = new FormData();
      form.append('file', file);
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${BASE}/resumes`);
      xhr.withCredentials = true;
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => {
        let data = {};
        try {
          data = JSON.parse(xhr.responseText);
        } catch {
          // ignore
        }
        if (xhr.status >= 200 && xhr.status < 300) resolve(data);
        else reject(new Error(data.error || `Upload failed (${xhr.status})`));
      };
      xhr.onerror = () => reject(new Error('Upload failed — check your connection.'));
      xhr.send(form);
    }),
  deleteResume: (id) => request(`/resumes/${id}`, { method: 'DELETE' }),

  // Job postings (Screen 3)
  listJobPostings: () => request('/job-postings'),
  getJobPosting: (id) => request(`/job-postings/${id}`),
  createJobPostingFromUrl: (url) => request('/job-postings', { method: 'POST', body: JSON.stringify({ url }) }),
  createJobPostingFromText: (text) => request('/job-postings', { method: 'POST', body: JSON.stringify({ text }) }),

  // Analyses (Screen 4)
  createAnalysis: (resumeId, jobPostingId) =>
    request('/analyses', { method: 'POST', body: JSON.stringify({ resumeId, jobPostingId }) }),
  getAnalysis: (id) => request(`/analyses/${id}`),
  listAnalyses: () => request('/analyses'),

  // Bullet improvement (Screen 5)
  listBulletSuggestions: (analysisId) => request(`/analyses/${analysisId}/bullets`),
  generateBulletOptions: (analysisId, bulletId) =>
    request(`/analyses/${analysisId}/bullets/${encodeURIComponent(bulletId)}/generate`, { method: 'POST' }),
  selectBulletOption: (analysisId, bulletId, body) =>
    request(`/analyses/${analysisId}/bullets/${encodeURIComponent(bulletId)}/select`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  // Export (Screen 6)
  exportUrl: (analysisId) => `${BASE}/analyses/${analysisId}/export`,
};
