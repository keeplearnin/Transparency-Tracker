/**
 * Pay-transparency rules for US jurisdictions.
 *
 * This file is the core asset of the checker. Every rule carries an effective
 * date, a coverage threshold, the elements a posting must contain, and the
 * source it was verified against. Update `LAST_REVIEWED` and the per-rule
 * `verified` date whenever you re-check a rule.
 *
 * Not legal advice. Summaries are simplified; always link users to the source.
 */

export const LAST_REVIEWED = "2026-10-18";

export type Kind = "posting" | "on-request";

export interface Jurisdiction {
  id: string;
  name: string;
  /** Two-letter state code the jurisdiction sits in. */
  state: string;
  level: "state" | "local";
  /** "posting" = range must be in the posting; "on-request" = disclose only when asked / after interview. */
  kind: Kind;
  /** ISO date the posting obligation takes effect. */
  effective: string;
  /** Minimum employee count for coverage (1 = any employer). */
  minEmployees: number;
  /** Plain-language note on how employees are counted. */
  headcountNote?: string;
  requires: {
    payRange: boolean;
    benefits: boolean;
    closeDate: boolean;
    jobDescription: boolean;
  };
  /** Short summary of when a posting is covered (remote, reporting lines, etc.). */
  coverage: string;
  notes?: string;
  sources: { label: string; url: string }[];
  verified: string;
}

const BRIGHTMINE = {
  label: "Brightmine 50-state chart (Oct 2026)",
  url: "https://www.brightmine.com/us/resources/hr-compliance/pay-transparency/u-s-pay-transparency-laws-by-state-and-locality/",
};
const JOBSPIPE = {
  label: "JobsPipe pay transparency tracker (Oct 2026)",
  url: "https://jobspipe.dev/blog/pay-transparency-by-state",
};

const R = (p: Partial<Jurisdiction["requires"]>): Jurisdiction["requires"] => ({
  payRange: true,
  benefits: false,
  closeDate: false,
  jobDescription: false,
  ...p,
});

export const JURISDICTIONS: Jurisdiction[] = [
  // ---- States with a posting requirement ----
  {
    id: "CO", name: "Colorado", state: "CO", level: "state", kind: "posting",
    effective: "2021-01-01", minEmployees: 1, headcountNote: "At least one employee in Colorado.",
    requires: R({ benefits: true, closeDate: true }),
    coverage: "Any posting for work that could be performed in Colorado, including remote roles open to Colorado residents.",
    notes: "Postings must also list the expected application deadline. Internal opportunities must be announced to all employees.",
    sources: [BRIGHTMINE, JOBSPIPE], verified: "2026-10-18",
  },
  {
    id: "CA", name: "California", state: "CA", level: "state", kind: "posting",
    effective: "2023-01-01", minEmployees: 15,
    requires: R({}),
    coverage: "Any job posting by a covered employer, including postings through third parties.",
    sources: [BRIGHTMINE, JOBSPIPE], verified: "2026-10-18",
  },
  {
    id: "WA", name: "Washington", state: "WA", level: "state", kind: "posting",
    effective: "2023-01-01", minEmployees: 15,
    requires: R({ benefits: true }),
    coverage: "Postings for roles in Washington or remote roles that could be filled by Washington residents.",
    notes: "Since 2025, employers get five business days to correct a non-compliant posting after notice.",
    sources: [{ label: "RCW 49.58.110", url: "https://app.leg.wa.gov/RCW/default.aspx?cite=49.58.110" }, BRIGHTMINE],
    verified: "2026-10-18",
  },
  {
    id: "NY", name: "New York", state: "NY", level: "state", kind: "posting",
    effective: "2023-09-17", minEmployees: 4,
    requires: R({ jobDescription: true }),
    coverage: "Roles performed at least partly in New York, or reporting to a New York office, supervisor or work site.",
    notes: "The job description must be included if one exists.",
    sources: [{ label: "NY Department of Labor", url: "https://dol.ny.gov/pay-transparency" }, BRIGHTMINE],
    verified: "2026-10-18",
  },
  {
    id: "HI", name: "Hawaii", state: "HI", level: "state", kind: "posting",
    effective: "2024-01-01", minEmployees: 50,
    requires: R({}),
    coverage: "External job listings. Internal promotion/transfer postings are excluded.",
    sources: [BRIGHTMINE, JOBSPIPE], verified: "2026-10-18",
  },
  {
    id: "DC", name: "District of Columbia", state: "DC", level: "state", kind: "posting",
    effective: "2024-06-30", minEmployees: 1, headcountNote: "At least one employee in DC.",
    requires: R({}),
    coverage: "All postings for a job, promotion or transfer. DC and federal government are excluded.",
    notes: "Healthcare benefits must be disclosed before the first interview (not necessarily in the posting).",
    sources: [BRIGHTMINE, JOBSPIPE], verified: "2026-10-18",
  },
  {
    id: "MD", name: "Maryland", state: "MD", level: "state", kind: "posting",
    effective: "2024-10-01", minEmployees: 1,
    requires: R({ benefits: true }),
    coverage: "Jobs physically performed at least partly in Maryland.",
    sources: [BRIGHTMINE, JOBSPIPE], verified: "2026-10-18",
  },
  {
    id: "IL", name: "Illinois", state: "IL", level: "state", kind: "posting",
    effective: "2025-01-01", minEmployees: 15,
    requires: R({ benefits: true }),
    coverage: "Postings for specific positions by employers with 15+ employees.",
    notes: "Current employees must be told of promotion opportunities within 14 days of an external posting.",
    sources: [BRIGHTMINE, JOBSPIPE], verified: "2026-10-18",
  },
  {
    id: "MN", name: "Minnesota", state: "MN", level: "state", kind: "posting",
    effective: "2025-01-01", minEmployees: 30, headcountNote: "30 or more employees in Minnesota.",
    requires: R({ benefits: true }),
    coverage: "Any job posting by a covered employer. Requires a starting salary range.",
    sources: [{ label: "Minn. Stat. 181.173", url: "https://www.revisor.mn.gov/statutes/cite/181.173" }, BRIGHTMINE],
    verified: "2026-10-18",
  },
  {
    id: "NJ", name: "New Jersey", state: "NJ", level: "state", kind: "posting",
    effective: "2025-06-01", minEmployees: 10,
    requires: R({ benefits: true }),
    coverage: "Internal and external postings by employers doing business, employing workers or taking applications in New Jersey.",
    notes: "A single hourly wage or salary is acceptable instead of a range.",
    sources: [BRIGHTMINE, JOBSPIPE], verified: "2026-10-18",
  },
  {
    id: "VT", name: "Vermont", state: "VT", level: "state", kind: "posting",
    effective: "2025-07-01", minEmployees: 5,
    requires: R({}),
    coverage: "Positions physically located in Vermont, or remote roles predominantly working for a Vermont office.",
    sources: [BRIGHTMINE, JOBSPIPE], verified: "2026-10-18",
  },
  {
    id: "MA", name: "Massachusetts", state: "MA", level: "state", kind: "posting",
    effective: "2025-10-29", minEmployees: 25, headcountNote: "25 or more employees in Massachusetts.",
    requires: R({}),
    coverage: "Any advertisement or posting recruiting for a specific role.",
    sources: [{ label: "Mass.gov pay transparency", url: "https://www.mass.gov/info-details/pay-transparency-in-massachusetts" }, BRIGHTMINE],
    verified: "2026-10-18",
  },
  {
    id: "VA", name: "Virginia", state: "VA", level: "state", kind: "posting",
    effective: "2026-07-01", minEmployees: 1,
    requires: R({}),
    coverage: "Every public and internal posting for a job, promotion or transfer.",
    notes: "Commission-only roles may state that pay is based solely on commission.",
    sources: [{ label: "Morgan Lewis: Virginia law", url: "https://www.morganlewis.com/pubs/2026/05/virginia-law-will-require-pay-transparency-restrict-employers-from-seeking-wage-history" }, BRIGHTMINE],
    verified: "2026-10-18",
  },
  {
    id: "ME", name: "Maine", state: "ME", level: "state", kind: "posting",
    effective: "2026-07-29", minEmployees: 10,
    requires: R({}),
    coverage: "Job postings by covered employers. Benefits disclosure is not required.",
    sources: [{ label: "Morgan Lewis: Maine law", url: "https://www.morganlewis.com/pubs/2026/05/maine-passes-pay-transparency-law" }, BRIGHTMINE],
    verified: "2026-10-18",
  },
  {
    id: "CT", name: "Connecticut", state: "CT", level: "state", kind: "posting",
    effective: "2026-10-01", minEmployees: 1,
    requires: R({}),
    coverage: "Positions performed in Connecticut or reporting directly to a Connecticut supervisor, office or work site.",
    sources: [{ label: "Foley: Connecticut expansion", url: "https://www.foley.com/insights/publications/2026/09/connecticut-expands-pay-transparency-requirements-starting-october-1-2026/" }, BRIGHTMINE],
    verified: "2026-10-18",
  },
  {
    id: "DE", name: "Delaware", state: "DE", level: "state", kind: "posting",
    effective: "2027-09-26", minEmployees: 26, headcountNote: "More than 25 employees.",
    requires: R({ benefits: true }),
    coverage: "Any job posting by a covered employer.",
    sources: [BRIGHTMINE, JOBSPIPE], verified: "2026-10-18",
  },

  // ---- States that require disclosure on request, not in the posting ----
  {
    id: "NV", name: "Nevada", state: "NV", level: "state", kind: "on-request",
    effective: "2021-10-01", minEmployees: 1,
    requires: R({ payRange: false }),
    coverage: "Applicants who complete an interview must be given the pay range.",
    sources: [BRIGHTMINE], verified: "2026-10-18",
  },
  {
    id: "RI", name: "Rhode Island", state: "RI", level: "state", kind: "on-request",
    effective: "2023-01-01", minEmployees: 1,
    requires: R({ payRange: false }),
    coverage: "Applicants may request the range before compensation is discussed.",
    sources: [BRIGHTMINE], verified: "2026-10-18",
  },

  // ---- Local laws ----
  {
    id: "NYC", name: "New York City", state: "NY", level: "local", kind: "posting",
    effective: "2022-11-01", minEmployees: 4,
    requires: R({}),
    coverage: "Roles that can or will be performed at least partly in New York City.",
    sources: [BRIGHTMINE], verified: "2026-10-18",
  },
  {
    id: "WESTCHESTER", name: "Westchester County, NY", state: "NY", level: "local", kind: "posting",
    effective: "2022-11-06", minEmployees: 4,
    requires: R({}),
    coverage: "Roles required to be performed at least partly in Westchester County.",
    sources: [BRIGHTMINE], verified: "2026-10-18",
  },
  {
    id: "ALBANY", name: "Albany County, NY", state: "NY", level: "local", kind: "posting",
    effective: "2023-03-09", minEmployees: 4,
    requires: R({}),
    coverage: "Ads for a job, promotion or transfer in Albany County.",
    notes: "Sources report the start date variously between March and June 2023; it is in force either way.",
    sources: [BRIGHTMINE], verified: "2026-10-18",
  },
  {
    id: "ITHACA", name: "Ithaca, NY", state: "NY", level: "local", kind: "posting",
    effective: "2022-09-01", minEmployees: 4,
    requires: R({}),
    coverage: "Employers whose standard work locations are in the city of Ithaca.",
    sources: [BRIGHTMINE], verified: "2026-10-18",
  },
  {
    id: "JERSEYCITY", name: "Jersey City, NJ", state: "NJ", level: "local", kind: "posting",
    effective: "2022-04-14", minEmployees: 5, headcountNote: "Five or more employees within Jersey City.",
    requires: R({}),
    coverage: "Ads for a job, promotion or transfer in Jersey City.",
    sources: [BRIGHTMINE], verified: "2026-10-18",
  },
  {
    id: "CLEVELAND", name: "Cleveland, OH", state: "OH", level: "local", kind: "posting",
    effective: "2025-10-27", minEmployees: 15, headcountNote: "15 or more employees within Cleveland.",
    requires: R({}),
    coverage: "Any notice, advertisement or posting for employment in Cleveland.",
    sources: [BRIGHTMINE], verified: "2026-10-18",
  },
  {
    id: "COLUMBUS", name: "Columbus, OH", state: "OH", level: "local", kind: "posting",
    effective: "2027-01-01", minEmployees: 15, headcountNote: "15 or more employees within Columbus.",
    requires: R({}),
    coverage: "Postings recruiting for a specific position in Columbus.",
    sources: [BRIGHTMINE], verified: "2026-10-18",
  },
  {
    id: "CINCINNATI", name: "Cincinnati, OH", state: "OH", level: "local", kind: "on-request",
    effective: "2020-03-13", minEmployees: 15,
    requires: R({ payRange: false }),
    coverage: "Applicants with a conditional offer may request the range.",
    sources: [BRIGHTMINE], verified: "2026-10-18",
  },
  {
    id: "TOLEDO", name: "Toledo, OH", state: "OH", level: "local", kind: "on-request",
    effective: "2020-06-25", minEmployees: 15,
    requires: R({ payRange: false }),
    coverage: "Applicants with a conditional offer may request the range.",
    sources: [BRIGHTMINE], verified: "2026-10-18",
  },
];

/** Every US state + DC, for location detection and the "where can this role be done" picker. */
export const US_STATES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado",
  CT: "Connecticut", DE: "Delaware", DC: "District of Columbia", FL: "Florida", GA: "Georgia",
  HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa", KS: "Kansas",
  KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland", MA: "Massachusetts",
  MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana",
  NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico",
  NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma",
  OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota",
  TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington",
  WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
};

/** City/county names that map to a local jurisdiction id. Lower-case keys. */
export const LOCAL_ALIASES: Record<string, string> = {
  "new york city": "NYC", "nyc": "NYC", "manhattan": "NYC", "brooklyn": "NYC", "queens": "NYC",
  "the bronx": "NYC", "staten island": "NYC",
  "westchester": "WESTCHESTER", "white plains": "WESTCHESTER", "yonkers": "WESTCHESTER",
  "albany": "ALBANY", "ithaca": "ITHACA", "jersey city": "JERSEYCITY",
  "cleveland": "CLEVELAND", "columbus": "COLUMBUS", "cincinnati": "CINCINNATI", "toledo": "TOLEDO",
};
