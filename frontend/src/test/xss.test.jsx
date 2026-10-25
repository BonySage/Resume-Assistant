// Cross-site scripting: everything the app shows from users or the AI (job
// title, file names, keywords, recommendations, resume bullets, AI rewrites)
// must render as plain text, never as HTML. These tests feed script payloads
// through the real pages and check nothing turns into live markup.
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import fs from 'node:fs';
import path from 'node:path';
import { AuthProvider } from '../context/AuthContext.jsx';
import { UIProvider } from '../lib/ui.jsx';
import { Icon } from '../lib/icons.jsx';
import Results from '../pages/Results.jsx';
import BulletImprove from '../pages/BulletImprove.jsx';

const XSS = '<img src=x onerror="window.__xss=1"><script>window.__xss=2</script>';

const bundle = {
  analysis: {
    id: 1, resumeId: 1, jobPostingId: 1, status: 'complete', score: 55,
    matchedKeywords: [`${XSS}matched`], missingCritical: [`${XSS}critical`], missingSecondary: [`${XSS}secondary`],
    weakKeywords: [`${XSS}weak`], recommendations: [`${XSS}recommendation`], jobTitle: `${XSS}title`, company: `${XSS}co`,
  },
  job: { id: 1, title: `${XSS}title`, company: `${XSS}co`, requiredSkills: { critical: [`${XSS}critical`], secondary: [] } },
  resume: {
    id: 1, filename: `${XSS}.pdf`,
    parsed: { experience: [{ title: `${XSS}job`, company: 'Acme', dates: '', bullets: [{ id: 'exp0-b0', text: `Built ${XSS}bullet` }] }] },
  },
  suggestions: [{
    id: 1, analysisId: 1, bulletId: 'exp0-b0', originalText: `Built ${XSS}bullet`, selectedIndex: null, selectedText: `${XSS}saved`,
    options: [{ text: `${XSS}option`, flagged: true, issues: [{ type: 'name', term: `${XSS}term` }] }],
  }],
};

vi.mock('../api.js', () => ({
  api: {
    me: vi.fn(async () => ({ user: { id: 1, email: 'alice@example.com' } })),
    generateBulletOptions: vi.fn(async () => ({ suggestion: bundle.suggestions[0] })),
    selectBulletOption: vi.fn(),
  },
  onSessionExpired: vi.fn(),
  loadAnalysisBundle: vi.fn(async () => bundle),
}));

function renderAt(url, routePath, Page) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <AuthProvider>
        <UIProvider>
          <Routes><Route path={routePath} element={<Page />} /></Routes>
        </UIProvider>
      </AuthProvider>
    </MemoryRouter>
  );
}

// Nothing from the payload may exist as a real element or attribute.
function expectNoInjectedMarkup() {
  expect(document.querySelector('img[src="x"]')).toBeNull();
  expect(document.querySelector('[onerror]')).toBeNull();
  expect(document.body.querySelector('script')).toBeNull();
  expect(window.__xss).toBeUndefined();
}

beforeEach(() => {
  cleanup();
  delete window.__xss;
});

describe('XSS: user and AI text renders as plain text', () => {
  test('results page (job title, company, file name, keywords, recommendations, bullets)', async () => {
    renderAt('/results/1', '/results/:analysisId', Results);
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(`${XSS}title`); // shown as text
    expect(document.body.textContent).toContain(`${XSS}recommendation`);
    expect(document.body.textContent).toContain(`${XSS}critical`);
    expect(document.body.textContent).toContain(`${XSS}.pdf`);
    expectNoInjectedMarkup();
  });

  test('bullet improvement page (resume bullet, AI options, flagged terms, saved text)', async () => {
    renderAt('/results/1/improve?bullet=exp0-b0', '/results/:analysisId/improve', BulletImprove);
    await screen.findAllByText((_, el) => el?.textContent?.includes('bullet') ?? false);
    expect(document.body.textContent).toContain(XSS);
    expectNoInjectedMarkup();
  });

  test('an icon name from data cannot inject markup', () => {
    const { container } = render(<Icon name={XSS} />);
    expect(container.querySelector('svg').innerHTML).toBe('');
    expectNoInjectedMarkup();
  });
});

// Source checks: the app must not bypass React's escaping. The only raw-HTML
// spot is the Icon component, which looks names up in a fixed list.
describe('XSS guards (source)', () => {
  const SRC = path.resolve(__dirname, '..');
  const files = (dir) => fs.readdirSync(dir, { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? (e.name === 'test' ? [] : files(path.join(dir, e.name))) : /\.(jsx?|tsx?)$/.test(e.name) ? [path.join(dir, e.name)] : []));
  const sources = files(SRC).map((f) => ({ file: path.relative(SRC, f).replaceAll('\\', '/'), text: fs.readFileSync(f, 'utf8') }));
  const using = (re) => sources.filter((s) => re.test(s.text.replace(/^\s*\/\/.*$/gm, ''))).map((s) => s.file);

  test('dangerouslySetInnerHTML is only used by the Icon component', () => {
    expect(using(/dangerouslySetInnerHTML/)).toEqual(['lib/icons.jsx']);
  });

  test('no innerHTML, document.write, eval or new Function', () => {
    expect(using(/\.(innerHTML|outerHTML)\s*=|insertAdjacentHTML|document\.write|\beval\(|new Function\(/)).toEqual([]);
  });

  test('no javascript: URLs', () => {
    expect(using(/javascript:/i)).toEqual([]);
  });
});
