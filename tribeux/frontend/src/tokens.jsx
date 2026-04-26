// tokens.jsx — design tokens + shared styles for Compound (Space Grotesk edition)

const TRIBE = {
  wash: '#E6EEF5',
  washDeep: '#CFDDEA',
  paper: '#F4F7FB',
  ink: '#0A1628',
  inkSoft: '#3A4A5F',
  inkMute: '#6A7A8E',
  inkFaint: '#9CA9BB',
  hair: 'rgba(10,22,40,0.08)',
  hairStrong: 'rgba(10,22,40,0.14)',

  teal: '#0FB5A8',
  tealDeep: '#0E8F86',
  tealLight: '#7FDED3',
  tealGlow: 'rgba(15,181,168,0.45)',

  heat1: '#F9D84A',
  heat2: '#F59E3A',
  heat3: '#E04949',

  fUI: '"Space Grotesk", ui-sans-serif, system-ui, sans-serif',
  fDisplay: '"Space Grotesk", ui-sans-serif, system-ui, sans-serif',
  fMono: '"JetBrains Mono", ui-monospace, Menlo, monospace',
};

if (!document.getElementById('tribe-base')) {
  const s = document.createElement('style');
  s.id = 'tribe-base';
  s.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=JetBrains+Mono:wght@300;400;500&display=swap');

    .tb-root{font-family:${TRIBE.fUI};color:${TRIBE.ink};-webkit-font-smoothing:antialiased;
      text-rendering:optimizeLegibility;letter-spacing:-0.01em}
    .tb-root *{box-sizing:border-box}
    .tb-display{font-family:${TRIBE.fDisplay};font-weight:500;letter-spacing:-0.035em;line-height:0.94}
    .tb-mono{font-family:${TRIBE.fMono};font-feature-settings:"ss01","cv11"}
    /* Sentence-case eyebrow with tracked letters — no all-caps */
    .tb-eyebrow{font-family:${TRIBE.fMono};font-size:11px;letter-spacing:0.04em;color:${TRIBE.inkMute};font-weight:400}

    /* Liquid glass primitives */
    .tb-glass{
      background:linear-gradient(180deg,rgba(255,255,255,0.72) 0%,rgba(255,255,255,0.42) 100%);
      -webkit-backdrop-filter:blur(18px) saturate(160%);
      backdrop-filter:blur(18px) saturate(160%);
      border:0.5px solid rgba(255,255,255,0.75);
      box-shadow:
        inset 0 1px 0 rgba(255,255,255,0.9),
        inset 0 -1px 0 rgba(10,22,40,0.04),
        0 1px 2px rgba(10,22,40,0.04),
        0 10px 40px -12px rgba(10,22,40,0.18);
    }
    .tb-glass-deep{
      background:linear-gradient(180deg,rgba(255,255,255,0.55) 0%,rgba(230,238,245,0.25) 100%);
      -webkit-backdrop-filter:blur(28px) saturate(180%);
      backdrop-filter:blur(28px) saturate(180%);
      border:0.5px solid rgba(255,255,255,0.6);
      box-shadow:
        inset 0 1px 0 rgba(255,255,255,0.9),
        inset 0 0 30px rgba(127,222,211,0.12),
        0 20px 60px -20px rgba(10,80,100,0.25);
    }
    .tb-glass-btn-teal{
      background:linear-gradient(180deg,${TRIBE.teal} 0%,${TRIBE.tealDeep} 100%);
      color:#fff;border:0.5px solid rgba(255,255,255,0.25);
      box-shadow:
        inset 0 1px 0 rgba(255,255,255,0.35),
        inset 0 -1px 0 rgba(0,50,48,0.25),
        0 1px 2px rgba(14,143,134,0.2),
        0 10px 24px -6px rgba(14,143,134,0.5);
      transition:transform .18s cubic-bezier(.2,.7,.3,1), box-shadow .18s;
    }
    .tb-glass-btn-teal:hover{transform:translateY(-1px);
      box-shadow:
        inset 0 1px 0 rgba(255,255,255,0.4),
        inset 0 -1px 0 rgba(0,50,48,0.25),
        0 14px 32px -8px rgba(14,143,134,0.6)}

    @keyframes tb-scan {
      0%{transform:translateY(-8%);opacity:0}
      8%{opacity:1} 92%{opacity:1}
      100%{transform:translateY(108%);opacity:0}
    }
    @keyframes tb-pulse {
      0%,100%{opacity:0.55;transform:scale(1)}
      50%{opacity:1;transform:scale(1.04)}
    }
    @keyframes tb-rise {
      from{opacity:0;transform:translateY(14px)}
      to{opacity:1;transform:translateY(0)}
    }
    @keyframes tb-orb-rotate { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
    @keyframes tb-breathe {
      0%,100%{transform:scale(1);filter:brightness(1)}
      50%{transform:scale(1.008);filter:brightness(1.03)}
    }
    @keyframes tb-blink { 0%,100%{opacity:1} 50%{opacity:0.3} }
    @keyframes tb-tick { 0%{opacity:0} 50%{opacity:1} 100%{opacity:0} }

    .tb-rise{animation:tb-rise .7s cubic-bezier(.2,.7,.3,1) both}
    .tb-rise-1{animation-delay:.05s} .tb-rise-2{animation-delay:.15s}
    .tb-rise-3{animation-delay:.25s} .tb-rise-4{animation-delay:.35s}
    .tb-rise-5{animation-delay:.45s} .tb-rise-6{animation-delay:.55s}
    .tb-rise-7{animation-delay:.65s} .tb-rise-8{animation-delay:.75s}

    .tb-env{
      position:absolute;inset:0;pointer-events:none;overflow:hidden;
      background:
        radial-gradient(ellipse 60% 40% at 20% 10%, rgba(127,222,211,0.18), transparent 60%),
        radial-gradient(ellipse 50% 50% at 90% 80%, rgba(127,222,211,0.14), transparent 65%),
        radial-gradient(ellipse 80% 60% at 50% 50%, rgba(244,247,251,0.6), transparent 70%),
        linear-gradient(180deg, ${TRIBE.wash} 0%, #DCE7F0 60%, ${TRIBE.washDeep} 100%);
    }
    .tb-grain{position:absolute;inset:0;pointer-events:none;opacity:.35;mix-blend-mode:overlay;
      background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='n'><feTurbulence baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.04 0 0 0 0 0.09 0 0 0 0 0.16 0 0 0 0.5 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>")}

    .tb-corner{position:absolute;width:10px;height:10px;border:1px solid ${TRIBE.ink};opacity:0.55}
    .tb-corner.tl{top:-1px;left:-1px;border-right:0;border-bottom:0}
    .tb-corner.tr{top:-1px;right:-1px;border-left:0;border-bottom:0}
    .tb-corner.bl{bottom:-1px;left:-1px;border-right:0;border-top:0}
    .tb-corner.br{bottom:-1px;right:-1px;border-left:0;border-top:0}

    .tb-input{all:unset;font-family:${TRIBE.fUI};font-size:15px;color:${TRIBE.ink};
      width:100%;padding:0;caret-color:${TRIBE.teal}}
    .tb-input::placeholder{color:${TRIBE.inkMute}}

    .tb-tick-row{display:flex;gap:3px}
    .tb-tick{width:2px;height:10px;background:${TRIBE.hair};border-radius:1px}
    .tb-tick.on{background:${TRIBE.teal};box-shadow:0 0 4px ${TRIBE.tealGlow}}

    /* Dotted hairline divider */
    .tb-div{border:0;border-top:1px dashed ${TRIBE.hairStrong};margin:0}
  `;
  document.head.appendChild(s);
}

window.TRIBE = TRIBE;
