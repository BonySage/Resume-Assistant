import { describe, it, expect, vi } from 'vitest';
import { listAllPages } from '../api.js';
import {
  fmtDate,
  fileKind,
  kb,
  scoreLevel,
  jobLabel,
  resumeBullets,
  containsKeyword,
  highlightKeywords,
  safeFileName,
} from '../lib/format.js';

// ─── fmtDate ────────────────────────────────────────────────────────────────

describe('fmtDate', () => {
  it('returns empty string for falsy input', () => {
    expect(fmtDate(null)).toBe('');
    expect(fmtDate(undefined)).toBe('');
    expect(fmtDate('')).toBe('');
  });

  it('returns "Today" for today\'s date', () => {
    expect(fmtDate(new Date().toISOString())).toBe('Today');
  });

  it('returns a formatted date for a past date', () => {
    // Pick a date guaranteed to not be today: Jan 5 of a past year
    const past = new Date(2020, 0, 5).toISOString(); // Jan 5, 2020
    expect(fmtDate(past)).toMatch(/Jan\s+5/);
  });
});

// ─── fileKind ────────────────────────────────────────────────────────────────

describe('fileKind', () => {
  it('returns "docx" for .docx files (case-insensitive)', () => {
    expect(fileKind('resume.docx')).toBe('docx');
    expect(fileKind('CV.DOCX')).toBe('docx');
  });

  it('returns "pdf" for .pdf files and anything else', () => {
    expect(fileKind('resume.pdf')).toBe('pdf');
    expect(fileKind('resume.PDF')).toBe('pdf');
    expect(fileKind('no-extension')).toBe('pdf');
    expect(fileKind('')).toBe('pdf');
  });
});

// ─── kb ──────────────────────────────────────────────────────────────────────

describe('kb', () => {
  it('converts bytes to KB, minimum 1 KB', () => {
    expect(kb(0)).toBe('1 KB');
    expect(kb(500)).toBe('1 KB');
    expect(kb(1024)).toBe('1 KB');
    expect(kb(2048)).toBe('2 KB');
    expect(kb(1536)).toBe('2 KB');
  });

  it('handles null/undefined gracefully', () => {
    expect(kb(null)).toBe('1 KB');
    expect(kb(undefined)).toBe('1 KB');
  });
});

// ─── scoreLevel ──────────────────────────────────────────────────────────────

describe('scoreLevel', () => {
  it('returns "none" / N/A for null or undefined', () => {
    expect(scoreLevel(null)).toMatchObject({ key: 'none', word: 'N/A' });
    expect(scoreLevel(undefined)).toMatchObject({ key: 'none', word: 'N/A' });
  });

  it('returns "good" / Strong for 75 and above', () => {
    expect(scoreLevel(75)).toMatchObject({ key: 'good', word: 'Strong' });
    expect(scoreLevel(100)).toMatchObject({ key: 'good', word: 'Strong' });
  });

  it('returns "fair" / Fair for 50–74', () => {
    expect(scoreLevel(50)).toMatchObject({ key: 'fair', word: 'Fair' });
    expect(scoreLevel(74)).toMatchObject({ key: 'fair', word: 'Fair' });
  });

  it('returns "bad" / Low for below 50', () => {
    expect(scoreLevel(0)).toMatchObject({ key: 'bad', word: 'Low' });
    expect(scoreLevel(49)).toMatchObject({ key: 'bad', word: 'Low' });
  });

  it('every level has a key, word and icon', () => {
    for (const v of [null, 0, 50, 75]) {
      const l = scoreLevel(v);
      expect(l).toHaveProperty('key');
      expect(l).toHaveProperty('word');
      expect(l).toHaveProperty('icon');
    }
  });
});

// ─── jobLabel ────────────────────────────────────────────────────────────────

describe('jobLabel', () => {
  it('returns "Job posting" when job is falsy', () => {
    expect(jobLabel(null)).toBe('Job posting');
    expect(jobLabel(undefined)).toBe('Job posting');
  });

  it('returns the job title when present', () => {
    expect(jobLabel({ title: 'Software Engineer' })).toBe('Software Engineer');
  });

  it('returns "Untitled role" when title is absent or empty', () => {
    expect(jobLabel({})).toBe('Untitled role');
    expect(jobLabel({ title: '' })).toBe('Untitled role');
  });
});

// ─── resumeBullets ───────────────────────────────────────────────────────────

describe('resumeBullets', () => {
  it('returns empty array for null/missing parsed data', () => {
    expect(resumeBullets(null)).toEqual([]);
    expect(resumeBullets(undefined)).toEqual([]);
    expect(resumeBullets({})).toEqual([]);
  });

  it('flattens bullets from multiple experiences', () => {
    const parsed = {
      experience: [
        { title: 'Dev', company: 'Acme', bullets: [{ id: 'b1', text: 'Built things' }] },
        { title: 'Lead', company: 'Corp', bullets: [{ id: 'b2', text: 'Led team' }, { id: 'b3', text: 'Shipped product' }] },
      ],
    };
    const bullets = resumeBullets(parsed);
    expect(bullets).toHaveLength(3);
    expect(bullets[0]).toMatchObject({ id: 'b1', where: 'Dev · Acme' });
    expect(bullets[2]).toMatchObject({ id: 'b3', where: 'Lead · Corp' });
  });

  it('uses "Experience" as fallback where label when title and company are missing', () => {
    const parsed = { experience: [{ bullets: [{ id: 'x', text: 'Did stuff' }] }] };
    expect(resumeBullets(parsed)[0].where).toBe('Experience');
  });

  it('handles experiences with no bullets gracefully', () => {
    const parsed = { experience: [{ title: 'PM', company: 'Co', bullets: [] }] };
    expect(resumeBullets(parsed)).toEqual([]);
  });
});

// ─── containsKeyword ─────────────────────────────────────────────────────────

describe('containsKeyword', () => {
  it('matches whole words only (case-insensitive)', () => {
    expect(containsKeyword('Expert in Python and JavaScript', 'python')).toBe(true);
    expect(containsKeyword('Expert in Python and JavaScript', 'PYTHON')).toBe(true);
  });

  it('does not match partial words', () => {
    // "react" should not match inside "reactionary"
    expect(containsKeyword('A reactionary approach', 'react')).toBe(false);
  });

  it('returns false for falsy keyword or text', () => {
    expect(containsKeyword('some text', '')).toBe(false);
    expect(containsKeyword('some text', null)).toBe(false);
    expect(containsKeyword(null, 'python')).toBe(false);
  });
});

// ─── highlightKeywords ───────────────────────────────────────────────────────

describe('highlightKeywords', () => {
  it('returns a single unmarked segment when no keywords match', () => {
    const result = highlightKeywords('Hello world', ['python']);
    expect(result).toEqual([{ text: 'Hello world', mark: false }]);
  });

  it('marks matched keywords correctly', () => {
    const result = highlightKeywords('I know React and Python', ['react', 'python']);
    const marked = result.filter((s) => s.mark).map((s) => s.text.toLowerCase());
    expect(marked).toContain('react');
    expect(marked).toContain('python');
  });

  it('handles empty keywords array without crashing', () => {
    const result = highlightKeywords('Some text', []);
    expect(result).toEqual([{ text: 'Some text', mark: false }]);
  });

  it('handles empty text without crashing', () => {
    const result = highlightKeywords('', ['python']);
    // Empty input → nothing to segment → empty array (not a crash)
    expect(result).toEqual([]);
  });
});

// ─── safeFileName ────────────────────────────────────────────────────────────

describe('safeFileName', () => {
  it('strips characters that are not word chars, hyphens, or spaces', () => {
    expect(safeFileName('My Resume (2024)!')).toBe('My_Resume_2024');
  });

  it('replaces spaces with underscores', () => {
    expect(safeFileName('John Doe CV')).toBe('John_Doe_CV');
  });

  it('returns "resume" for falsy or empty input', () => {
    expect(safeFileName('')).toBe('resume');
    expect(safeFileName(null)).toBe('resume');
    expect(safeFileName(undefined)).toBe('resume');
  });

  it('truncates to 60 characters', () => {
    const long = 'a'.repeat(80);
    expect(safeFileName(long).length).toBeLessThanOrEqual(60);
  });
});

describe('listAllPages', () => {
  it('fetches every page and preserves record order', async () => {
    const fetchPage = vi.fn(async ({ page }) => ({
      resumes: [`resume-${page}`],
      pagination: { pages: 3 },
    }));

    await expect(listAllPages(fetchPage, 'resumes')).resolves.toEqual([
      'resume-1',
      'resume-2',
      'resume-3',
    ]);
    expect(fetchPage).toHaveBeenNthCalledWith(1, { page: 1, limit: 100 });
    expect(fetchPage).toHaveBeenNthCalledWith(2, { page: 2, limit: 100 });
    expect(fetchPage).toHaveBeenNthCalledWith(3, { page: 3, limit: 100 });
  });

  it('supports APIs that do not include pagination metadata', async () => {
    const fetchPage = vi.fn(async () => ({ resumes: ['resume-1'] }));
    await expect(listAllPages(fetchPage, 'resumes')).resolves.toEqual(['resume-1']);
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });
});
