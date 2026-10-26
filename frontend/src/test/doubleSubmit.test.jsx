// Spam-click protection (TESTING.md 3.4): however often the user clicks or
// presses Enter, only one request may go out while one is already running.
// The clicks here land before React re-renders, which is the window where a
// disabled button alone doesn't help (a fast double-click, a held Enter key).
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup, act, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext.jsx';
import { UIProvider } from '../lib/ui.jsx';
import JobPosting from '../pages/JobPosting.jsx';
import { api } from '../api.js';

const never = () => new Promise(() => {}); // a request that is still running

vi.mock('../api.js', () => ({
  api: {
    me: vi.fn(async () => ({ user: { id: 1, email: 'alice@example.com' } })),
    listResumes: vi.fn(),
    createJobPostingFromText: vi.fn(),
    createJobPostingFromUrl: vi.fn(),
    createAnalysis: vi.fn(),
  },
  onSessionExpired: vi.fn(),
  listAllPages: vi.fn(async () => [{ id: 1, filename: 'resume.pdf', parseError: null, bulletCount: 3, sectionCount: 5 }]),
}));

const JOB_TEXT = 'We are hiring a Backend Engineer at Globex. Requirements: C++, C#, Python and Kubernetes. Nice to have: SQL.';

async function renderJobPage() {
  render(
    <MemoryRouter initialEntries={['/job']}>
      <AuthProvider>
        <UIProvider>
          <Routes>
            <Route path="/job" element={<JobPosting />} />
            <Route path="/results/:id" element={<p>results page</p>} />
          </Routes>
        </UIProvider>
      </AuthProvider>
    </MemoryRouter>
  );
  await screen.findByText('resume.pdf'); // resumes loaded
}

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('spam-click protection on the job page', () => {
  test('clicking "Analyze match" 5 times sends one job-posting request', async () => {
    api.createJobPostingFromText.mockImplementation(never);
    await renderJobPage();
    fireEvent.click(screen.getByRole('tab', { name: /paste description/i }));
    fireEvent.change(screen.getByLabelText(/job description/i), { target: { value: JOB_TEXT } });

    const button = screen.getByRole('button', { name: /analyze match/i });
    act(() => {
      for (let i = 0; i < 5; i++) button.click();
    });

    expect(api.createJobPostingFromText).toHaveBeenCalledTimes(1);
  });

  test('after a failed attempt, the button works again', async () => {
    api.createJobPostingFromText.mockRejectedValueOnce(new Error('The AI service is busy right now.')).mockImplementation(never);
    await renderJobPage();
    fireEvent.click(screen.getByRole('tab', { name: /paste description/i }));
    fireEvent.change(screen.getByLabelText(/job description/i), { target: { value: JOB_TEXT } });

    fireEvent.click(screen.getByRole('button', { name: /analyze match/i }));
    expect(await screen.findByText('The AI service is busy right now.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /analyze match/i }));

    expect(api.createJobPostingFromText).toHaveBeenCalledTimes(2);
  });

  test('submitting the job link 5 times (e.g. holding Enter) sends one request', async () => {
    api.createJobPostingFromUrl.mockImplementation(never);
    await renderJobPage();
    fireEvent.change(screen.getByLabelText(/job posting link/i), { target: { value: 'https://careers.example.com/jobs/1' } });

    const form = screen.getByLabelText(/job posting link/i).closest('form');
    act(() => {
      for (let i = 0; i < 5; i++) form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    expect(api.createJobPostingFromUrl).toHaveBeenCalledTimes(1);
  });

  test('a description under 50 characters shows a "too short" error and sends nothing (TESTING.md 3.5)', async () => {
    await renderJobPage();
    fireEvent.click(screen.getByRole('tab', { name: /paste description/i }));
    fireEvent.change(screen.getByLabelText(/job description/i), { target: { value: 'Need a dev with C++ and Python skills, apply now!' } }); // 49

    fireEvent.click(screen.getByRole('button', { name: /analyze match/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/too short/i);
    expect(screen.getByLabelText(/job description/i)).toHaveFocus();
    expect(api.createJobPostingFromText).not.toHaveBeenCalled();
  });

  test('50 characters is enough, the same minimum as the server', async () => {
    api.createJobPostingFromText.mockImplementation(never);
    await renderJobPage();
    fireEvent.click(screen.getByRole('tab', { name: /paste description/i }));
    fireEvent.change(screen.getByLabelText(/job description/i), { target: { value: 'Need a dev with C++ and Python skills. Apply now!!' } }); // 50

    fireEvent.click(screen.getByRole('button', { name: /analyze match/i }));

    expect(api.createJobPostingFromText).toHaveBeenCalledTimes(1);
  });

  test('with no description at all, Analyze stays disabled', async () => {
    await renderJobPage();
    fireEvent.click(screen.getByRole('tab', { name: /paste description/i }));
    fireEvent.change(screen.getByLabelText(/job description/i), { target: { value: '   ' } });
    expect(screen.getByRole('button', { name: /analyze match/i })).toBeDisabled();
  });

  test('after Cancel, extracting again works at once, and is still protected from spam', async () => {
    // Like the real request: it only ends when its signal is aborted.
    api.createJobPostingFromUrl.mockImplementation((url, signal) => new Promise((_, reject) => {
      signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
    }));
    await renderJobPage();
    fireEvent.change(screen.getByLabelText(/job posting link/i), { target: { value: 'https://careers.example.com/jobs/1' } });
    const form = screen.getByLabelText(/job posting link/i).closest('form');
    const submit = () => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    act(() => { submit(); });
    const cancel = await screen.findByRole('button', { name: 'Cancel' });
    act(() => {
      cancel.click();
      submit(); // straight after Cancel, before the cancelled request has finished
    });
    expect(api.createJobPostingFromUrl).toHaveBeenCalledTimes(2);

    await act(async () => {}); // the cancelled request finishes now; it must not unlock the new one
    act(() => {
      for (let i = 0; i < 5; i++) submit();
    });
    expect(api.createJobPostingFromUrl).toHaveBeenCalledTimes(2);
  });
});
