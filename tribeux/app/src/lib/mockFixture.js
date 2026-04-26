/**
 * Canned `Report` fixture for ?mock=1.
 *
 * Mirrors `tribeux_server.schemas.Report` exactly so the frontend can
 * render the findings page with no backend running. Numbers are seeded
 * from `tribeux-server/samples/site_1.json` (the v1 inference baseline)
 * with a hand-written Claude block + plausible v2 lift on top.
 *
 * Edit this file when the visual story you want to demo changes — the
 * rest of the mock pipeline is dumb plumbing.
 */

// Tiny inline SVG → data URL helpers. We use these for the §B frame cards
// and the §D before/after screenshots so the layout has actual images
// without shipping any binary assets.
function svgDataUrl(body, w = 256, h = 256) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${body}</svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

function frameDataUrl(label, tint) {
  return svgDataUrl(`
    <rect width="256" height="256" fill="${tint}"/>
    <rect x="6" y="6" width="244" height="22" fill="oklch(0.92 0.003 250)" stroke="oklch(0.16 0.010 260)" stroke-width="1.5"/>
    <circle cx="14" cy="17" r="3" fill="oklch(0.66 0.22 35)"/>
    <circle cx="24" cy="17" r="3" fill="oklch(0.87 0.17 95)"/>
    <circle cx="34" cy="17" r="3" fill="oklch(0.60 0.16 155)"/>
    <rect x="20" y="48" width="216" height="14" fill="oklch(0.16 0.010 260)" opacity="0.85"/>
    <rect x="20" y="68" width="160" height="6" fill="oklch(0.16 0.010 260)" opacity="0.45"/>
    <rect x="20" y="100" width="100" height="40" fill="oklch(0.66 0.22 35)" opacity="0.85"/>
    <rect x="20" y="160" width="216" height="3" fill="oklch(0.16 0.010 260)" opacity="0.25"/>
    <rect x="20" y="170" width="180" height="3" fill="oklch(0.16 0.010 260)" opacity="0.25"/>
    <rect x="20" y="180" width="200" height="3" fill="oklch(0.16 0.010 260)" opacity="0.25"/>
    <text x="20" y="240" font-family="monospace" font-size="9" fill="oklch(0.16 0.010 260)" opacity="0.6">${label}</text>
  `)
}

function screenshotDataUrl(version) {
  const tint = version === 'v1' ? 'oklch(0.93 0.02 220)' : 'oklch(0.94 0.05 95)'
  const accent = version === 'v1' ? 'oklch(0.66 0.22 35)' : 'oklch(0.60 0.16 155)'
  return svgDataUrl(`
    <rect width="800" height="500" fill="${tint}"/>
    <rect x="40" y="40" width="720" height="36" fill="oklch(0.16 0.010 260)" opacity="0.9"/>
    <rect x="40" y="98" width="540" height="22" fill="oklch(0.16 0.010 260)" opacity="0.45"/>
    <rect x="40" y="130" width="380" height="14" fill="oklch(0.16 0.010 260)" opacity="0.3"/>
    <rect x="40" y="170" width="180" height="56" fill="${accent}" opacity="0.9"/>
    <rect x="40" y="280" width="720" height="3" fill="oklch(0.16 0.010 260)" opacity="0.2"/>
    <rect x="40" y="300" width="640" height="3" fill="oklch(0.16 0.010 260)" opacity="0.2"/>
    <rect x="40" y="320" width="700" height="3" fill="oklch(0.16 0.010 260)" opacity="0.2"/>
    <rect x="40" y="380" width="220" height="40" fill="oklch(0.16 0.010 260)"/>
    <text x="60" y="62" font-family="sans-serif" font-size="14" font-weight="700" fill="oklch(0.92 0.003 250)">${version === 'v1' ? 'compound · current' : 'compound · proposed'}</text>
  `, 800, 500)
}

const FRAMES = [
  { t: 0,  label: 'fold: hero+cta',                   tint: 'oklch(0.93 0.02 220)' },
  { t: 3,  label: 't=3 · features',                   tint: 'oklch(0.94 0.04 100)' },
  { t: 5,  label: 't=5 · social proof',               tint: 'oklch(0.92 0.03 280)' },
  { t: 8,  label: 't=8 · pricing',                    tint: 'oklch(0.93 0.05 25)' },
  { t: 9,  label: 't=9 · pricing tail',               tint: 'oklch(0.92 0.05 25)' },
  { t: 10, label: 't=10 · footer cta',                tint: 'oklch(0.91 0.06 35)' },
  { t: 11, label: 't=11 · trust strip',               tint: 'oklch(0.91 0.06 35)' },
  { t: 12, label: 't=12 · footer',                    tint: 'oklch(0.91 0.07 30)' },
].map((f) => ({
  t: f.t,
  seconds: f.t * 0.4,
  data_url: frameDataUrl(f.label, f.tint),
  width: 256,
  height: 256,
}))

const V1_INFERENCE = {
  site_id: 'mock_site_1',
  label: 'compound mock',
  metadata: {
    url_or_description: 'https://example.com',
    tribe_timesteps: 13,
    scored_at_utc: '2026-04-26T03:35:55.355715Z',
    pipeline_version: 'tribeux_v0.1_mock',
    modalities_scored: ['video'],
  },
  video_modality: {
    headline_scores_within_site: {
      attention: 0.073,
      self_relevance: -0.315,
      reward: -0.277,
      disgust: 0.178,
      overall: -0.697,
    },
    headline_scores_vs_cohort: {
      attention:      { raw_score:  0.0318, cohort_z:  0.191, percentile: 58 },
      self_relevance: { raw_score: -0.0248, cohort_z: -0.937, percentile: 17 },
      reward:         { raw_score: -0.0096, cohort_z: -0.570, percentile: 28 },
      disgust:        { raw_score:  0.0654, cohort_z:  1.398, percentile: 92 },
    },
    time_series_zscored: {
      attention:      [ 0.2172,  0.1519,  0.1116,  0.0958,  0.1377,  0.0727, -0.0184, -0.0134,  0.0101, -0.1112, -0.2453, -0.1036,  0.2986],
      self_relevance: [-0.4984, -0.4952, -0.5041, -0.5080, -0.5000, -0.4917, -0.4644, -0.4488, -0.3793, -0.3522, -0.3290, -0.3909,  0.2208],
      reward:         [ 0.0194,  0.0889,  0.0918,  0.0559, -0.0055,  0.0073, -0.0431, -0.1931, -0.2874, -0.2709, -0.6340, -0.3842, -0.4615],
      disgust:        [-0.0398, -0.1168, -0.1789, -0.2813, -0.2272, -0.3050, -0.3719, -0.3981, -0.3850, -0.4753, -0.5998, -0.4010,  0.7011],
    },
    time_series_absolute: {
      attention:      [ 0.0072, -0.0015, -0.0050, -0.0011,  0.0132,  0.0085,  0.0050,  0.0246,  0.0336,  0.0166,  0.0173,  0.0107,  0.1186],
      self_relevance: [-0.0697, -0.0830, -0.0875, -0.0850, -0.0750, -0.0734, -0.0562, -0.0307, -0.0100, -0.0059,  0.0119, -0.0102,  0.1055],
      reward:         [-0.0141, -0.0094, -0.0076, -0.0067, -0.0066, -0.0010,  0.0016,  0.0017,  0.0003,  0.0017, -0.0076, -0.0097, -0.0094],
      disgust:        [-0.0204, -0.0353, -0.0439, -0.0535, -0.0373, -0.0463, -0.0435, -0.0243, -0.0107, -0.0174, -0.0054, -0.0110,  0.1863],
    },
  },
}

// v2 is v1 with the proposed patches applied. We shift the worst-axis
// (disgust) z-scores down toward 0 to simulate the predicted uplift.
const V2_INFERENCE = {
  ...V1_INFERENCE,
  site_id: 'mock_site_1_v2',
  label: 'compound mock v2',
  video_modality: {
    ...V1_INFERENCE.video_modality,
    headline_scores_vs_cohort: {
      attention:      { raw_score:  0.0318, cohort_z:  0.191, percentile: 58 },
      self_relevance: { raw_score: -0.0185, cohort_z: -0.482, percentile: 33 },
      reward:         { raw_score: -0.0028, cohort_z: -0.118, percentile: 45 },
      disgust:        { raw_score:  0.0411, cohort_z:  0.620, percentile: 73 },
    },
  },
}

const ANOMALIES = [
  {
    axis: 'disgust',
    t_start: 11,
    t_end: 12,
    severity: 0.70,
    headline: 'disgust spike on pricing tail',
    rationale:
      'Removes the exclamation and softens insula activation. Insula proxy peaks at t=12s (+0.70σ). Likely caused by a high-contrast, exclamation-heavy element.',
    frame_indices: [10, 11, 12],
  },
  {
    axis: 'reward',
    t_start: 9,
    t_end: 11,
    severity: 0.63,
    headline: 'reward dips through pricing/footer',
    rationale:
      'Adds a concrete reward cue to lift ventral-striatum prediction. Reward hits -0.63σ at t=10s, ventral striatum · VTA.',
    frame_indices: [8, 9, 10],
  },
  {
    axis: 'self_relevance',
    t_start: 3,
    t_end: 5,
    severity: 0.51,
    headline: 'self-relevance drops at features',
    rationale:
      'Recruits the precuneus by addressing the reader directly. Self Relevance hits -0.51σ at t=3s, DMN · precuneus.',
    frame_indices: [3, 4, 5],
  },
]

const PATCHES = [
  {
    unit_id: 'hero.cta_1',
    selector: 'button.hero__cta',
    section: 'hero',
    before_html: '<button class="hero__cta">Find your next stay!</button>',
    after_html: '<button class="hero__cta">Find your next stay</button>',
    rationale: 'Removes the exclamation and softens insula activation.',
    target_axis: 'disgust',
    expected_delta_z: 0.40,
  },
  {
    unit_id: 'hero.heading_1',
    selector: 'h1.hero__title',
    section: 'hero',
    before_html: '<h1 class="hero__title">Belong anywhere.</h1>',
    after_html: '<h1 class="hero__title">Belong anywhere — in one tap.</h1>',
    rationale: 'Adds a concrete reward cue to lift ventral-striatum prediction.',
    target_axis: 'reward',
    expected_delta_z: 0.45,
  },
  {
    unit_id: 'features.heading_1',
    selector: '.features h2',
    section: 'features',
    before_html: '<h2>What hosts make available</h2>',
    after_html: '<h2>Yours, on day one.</h2>',
    rationale: 'Recruits the precuneus by addressing the reader directly.',
    target_axis: 'self_relevance',
    expected_delta_z: 0.45,
  },
]

export const MOCK_REPORT = {
  url: 'https://example.com',
  v1: V1_INFERENCE,
  v2: V2_INFERENCE,
  cohort: {
    cohort_id: 'compound_mock_cohort',
    n: 30,
    sites: ['site_1', 'site_2', 'site_3'],
    axes: ['attention', 'self_relevance', 'reward', 'disgust'],
    axis_stats: {
      attention:      { mean: 0.012, std: 0.063 },
      self_relevance: { mean: 0.005, std: 0.052 },
      reward:         { mean: 0.018, std: 0.044 },
      disgust:        { mean: 0.020, std: 0.041 },
    },
    interpretation: {
      attention: 'fronto-parietal salience',
      self_relevance: 'DMN · precuneus',
      reward: 'ventral striatum · VTA',
      disgust: 'insula · orbito-frontal',
    },
    notes: 'Mock cohort. Real distribution is in tribeux-server samples.',
  },
  frames: FRAMES,
  findings: {
    summary:
      'Worst axis vs cohort is `disgust`. Found 3 anomaly window(s); proposing 3 edit(s) ranked by expected uplift on the misaligned axis.',
    anomalies: ANOMALIES,
    patches: PATCHES,
    asked_for_frame_indices: [11, 9, 3, 5],
    model: 'mock-claude',
    mock: true,
  },
  applied_patches: PATCHES.map((p) => ({ proposal: p, applied: true, error: null })),
  screenshot_v1_data_url: screenshotDataUrl('v1'),
  screenshot_v2_data_url: screenshotDataUrl('v2'),
  predicted_uplift_per_axis: {
    attention: 0.0,
    self_relevance: 0.45,
    reward: 0.45,
    disgust: 0.78,
  },
  overall_predicted_uplift: 1.43,
}

// Pipeline stages, mirroring tribeux-server. The mock walks through each
// at a fixed cadence so the demo page UI gets exercised.
export const MOCK_STAGES = [
  { key: 'render',    log: 'playwright · navigated to https://example.com' },
  { key: 'encode',    log: 'encode · 13 × 256² scrolling capture · 4.8s tensor' },
  { key: 'tribe',     log: 'tribev2 · forwarding 13 frames' },
  { key: 'project',   log: 'destrieux mapping · attention/self/reward/disgust' },
  { key: 'benchmark', log: 'v1 headline cohort_z = att +0.19 · self −0.94 · reward −0.57 · disgust +1.40' },
  { key: 'claude',    log: 'anomaly[disgust] t=11-12 σ=0.70' },
  { key: 'frames',    log: 'pulled 4 flagged frames · t=11,9,3,5' },
  { key: 'compose',   log: 'patch[hero.cta_1] applied · disgust Δz +0.40' },
  { key: 'done',      log: 'verdict ready · overall +1.43σ predicted uplift' },
]
