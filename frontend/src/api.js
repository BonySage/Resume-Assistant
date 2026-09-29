const BASE = import.meta.env.VITE_API_BASE_URL || '/api';

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
    err.status = res.status;
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
  deleteAccount: () => request('/auth/me', { method: 'DELETE' }),

  // Resumes
  listResumes: () => request('/resumes'),
  getResume: (id) => request(`/resumes/${id}`),
  // XHR (not fetch) so we get real upload progress events. Pass an AbortSignal to cancel.
  uploadResumeWithProgress: (file, onProgress, signal) =>
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
        else {
          if (data.code === 'SESSION_EXPIRED') sessionExpiredHandler?.(data.error);
          reject(new Error(data.error || `Upload failed (${xhr.status})`));
        }
      };
      xhr.onerror = () => reject(new Error('Upload failed — check your connection.'));
      xhr.onabort = () => {
        const err = new Error('Upload cancelled');
        err.name = 'AbortError';
        reject(err);
      };
      signal?.addEventListener('abort', () => xhr.abort());
      xhr.send(form);
    }),
  deleteResume: (id) => request(`/resumes/${id}`, { method: 'DELETE' }),

  // Job postings
  listJobPostings: () => request('/job-postings'),
  getJobPosting: (id) => request(`/job-postings/${id}`),
  createJobPostingFromUrl: (url, signal) => request('/job-postings', { method: 'POST', body: JSON.stringify({ url }), signal }),
  createJobPostingFromText: (text, signal) => request('/job-postings', { method: 'POST', body: JSON.stringify({ text }), signal }),

  // Analyses
  createAnalysis: (resumeId, jobPostingId) =>
    request('/analyses', { method: 'POST', body: JSON.stringify({ resumeId, jobPostingId }) }),
  getAnalysis: (id) => request(`/analyses/${id}`),
  listAnalyses: () => request('/analyses'),

  // Bullet improvement
  listBulletSuggestions: (analysisId) => request(`/analyses/${analysisId}/bullets`),
  generateBulletOptions: (analysisId, bulletId) =>
    request(`/analyses/${analysisId}/bullets/${encodeURIComponent(bulletId)}/generate`, { method: 'POST' }),
  selectBulletOption: (analysisId, bulletId, body) =>
    request(`/analyses/${analysisId}/bullets/${encodeURIComponent(bulletId)}/select`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  // Export: fetch the generated PDF and hand it to the browser under the chosen file name.
  exportUrl: (analysisId) => `${BASE}/analyses/${analysisId}/export`,
  downloadExport: async (analysisId, filename) => {
    const res = await fetch(`${BASE}/analyses/${analysisId}/export`, { credentials: 'include' });
    if (!res.ok) {
      let message = `Download failed (${res.status})`;
      try {
        const data = await res.json();
        if (data?.error) message = data.error;
        if (data?.code === 'SESSION_EXPIRED') sessionExpiredHandler?.(message);
      } catch {
        // ignore
      }
      throw new Error(message);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return blob.size;
  },
};

// Loads everything a flow screen (results / improve / export / done) needs for one analysis.
export async function loadAnalysisBundle(analysisId) {
  const { analysis } = await api.getAnalysis(analysisId);
  const [{ resume }, { jobPosting }, { suggestions }] = await Promise.all([
    api.getResume(analysis.resumeId),
    api.getJobPosting(analysis.jobPostingId),
    api.listBulletSuggestions(analysisId),
  ]);
  return { analysis, resume, job: jobPosting, suggestions };
}
