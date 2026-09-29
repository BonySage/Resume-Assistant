/* ==========================================================================
   Mock data + a tiny localStorage "store".
   There is no backend yet: this file stands in for the API described in the
   SRS so every screen can be clicked through end to end.
   ========================================================================== */
(function () {
  const KEY = "ra:state";

  const DEFAULT_STATE = {
    user: { name: "Alex Rivera", email: "alex.rivera@email.com" },
    activeResumeId: "r3",
    resumes: [
      { id: "r3", name: "Alex_Rivera_Resume_v3.pdf", kind: "pdf", date: "Sep 26", status: "ready", bullets: 14, sections: 5 },
      { id: "r2", name: "Alex_Rivera_Resume_v2.pdf", kind: "pdf", date: "Sep 24", status: "ready", bullets: 14, sections: 5 },
      { id: "r1", name: "Alex_Rivera_Resume.docx", kind: "docx", date: "Sep 12", status: "ready", bullets: 11, sections: 4 },
      { id: "r0", name: "scan_resume.pdf", kind: "pdf", date: "Sep 10", status: "error", bullets: 0, sections: 0 }
    ],
    analyses: [
      { id: "a2841", title: "Junior Data Analyst", company: "Northwind Bank", date: "Sep 25", score: 68 },
      { id: "a2790", title: "Business Intern", company: "Contoso Ltd", date: "Sep 22", score: 81 },
      { id: "a2702", title: "Marketing Associate", company: "Fabrikam", date: "Sep 18", score: 41 }
    ],
    job: { title: "Junior Data Analyst", company: "Northwind Bank" },
    saved: {} // bulletId -> chosen improved text
  };

  // The analysis the flow screens show (Northwind Bank · Junior Data Analyst)
  const ANALYSIS = {
    score: 68,
    keywords: {
      matched: ["SQL", "Excel", "Python", "Tableau", "Data cleaning", "Dashboards", "Pandas", "Git", "Data visualization", "Reporting", "Teamwork", "Problem solving"],
      missingCritical: ["Power BI", "Stakeholder reporting", "A/B testing", "KPIs"],
      missingSecondary: ["Snowflake", "Banking domain"],
      weak: ["Statistics", "ETL", "Communication"]
    },
    recommendations: [
      { html: "If you’ve used <strong>Power BI</strong>, name it in your Tableau dashboard bullet.", kw: "Power BI" },
      { html: "Show <strong>stakeholder reporting</strong> in your internship bullets: who you reported to, and how often.", kw: "Stakeholder reporting" },
      { html: "Add a number to your <strong>statistics</strong> work, such as a sample size or a % change.", kw: "Statistics" }
    ],
    bullets: [
      {
        id: "b1",
        text: "Built Tableau dashboards to track weekly sales for the team.",
        where: "Data Intern · Contoso",
        hint: "2 missing keywords could fit here",
        fits: ["Stakeholder reporting", "KPIs"],
        options: [
          { text: "Built weekly Tableau dashboards tracking 5 sales <mark>KPIs</mark>, used by a 12‑person team to spot trends early.", flag: null },
          { text: "Designed Tableau dashboards reporting weekly sales <mark>KPIs</mark> to 3 store managers, supporting <mark>stakeholder reporting</mark> every Monday.", flag: null },
          { text: "Created Tableau and <mark>Power BI</mark> dashboards to monitor weekly sales and share insights with <mark>stakeholders</mark>.", flag: "Power BI" }
        ]
      },
      {
        id: "b2",
        text: "Cleaned and merged survey data in Python for a class project.",
        where: "Projects · Capstone",
        hint: "1 weak keyword could be strengthened",
        fits: ["ETL", "Statistics"],
        options: [
          { text: "Built a Python (pandas) <mark>ETL</mark> script that cleaned and merged 3 survey files into one 2,000‑row dataset.", flag: null },
          { text: "Cleaned and merged 2,000 survey responses in Python, then used <mark>statistics</mark> to find the top 3 reasons for churn.", flag: null },
          { text: "Automated an <mark>ETL</mark> pipeline in Python and <mark>Snowflake</mark> to prepare survey data for analysis.", flag: "Snowflake" }
        ]
      },
      {
        id: "b3",
        text: "Helped prepare monthly reports in Excel.",
        where: "Office Assistant · Campus Library",
        hint: "Could show stakeholder reporting",
        fits: ["Stakeholder reporting", "Communication"],
        options: [
          { text: "Prepared monthly Excel usage reports for the library director, highlighting 3 trends each month.", flag: null },
          { text: "Compiled monthly Excel reports on visitor and loan numbers and presented findings to 4 staff leads (<mark>stakeholder reporting</mark>).", flag: null },
          { text: "Owned monthly <mark>KPI</mark> reporting in Excel, clearly <mark>communicating</mark> results to library leadership.", flag: null }
        ]
      }
    ]
  };

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return Object.assign(structuredClone(DEFAULT_STATE), JSON.parse(raw));
    } catch (e) { /* storage blocked or corrupt: fall back to defaults */ }
    return structuredClone(DEFAULT_STATE);
  }

  let state = load();

  window.RAData = {
    ANALYSIS,
    get state() { return state; },
    save(patch) {
      state = Object.assign(state, patch || {});
      try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
      return state;
    },
    reset() {
      state = structuredClone(DEFAULT_STATE);
      try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
      return state;
    },
    activeResume() {
      return state.resumes.find(r => r.id === state.activeResumeId) || state.resumes.find(r => r.status === "ready");
    },
    scoreLevel(n) {
      if (n >= 75) return { key: "good", word: "Strong", icon: "check" };
      if (n >= 50) return { key: "fair", word: "Fair", icon: "bang" };
      return { key: "bad", word: "Low", icon: "x" };
    }
  };
})();
