// App.jsx — root: hosts Variations A & B in a DesignCanvas, routes to report.

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "tealHue": 184,
  "glassStrength": 1,
  "brainPulse": true,
  "showScanHighlight": true
}/*EDITMODE-END*/;

function useHash() {
  const [h, setH] = React.useState(window.location.hash || '#/');
  React.useEffect(() => {
    const on = () => setH(window.location.hash || '#/');
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return h;
}

function LandingShell({ which }) {
  const [url, setUrl] = React.useState('');
  const [analyzing, setAnalyzing] = React.useState(false);
  const onSubmit = () => {
    if (!url.trim()) { setUrl('airbnb.com'); setTimeout(()=>setAnalyzing(true), 80); return; }
    setAnalyzing(true);
  };
  const Variant = which === 'A' ? window.LandingA : window.LandingB;
  return <Variant onSubmit={onSubmit} analyzing={analyzing} url={url} setUrl={setUrl}/>;
}

function App() {
  const hash = useHash();
  const [t, setTweak] = window.useTweaks(TWEAK_DEFAULTS);

  // Inject dynamic teal hue via CSS custom properties
  React.useEffect(() => {
    const s = document.getElementById('tribe-dynamic') || (() => {
      const el = document.createElement('style'); el.id = 'tribe-dynamic'; document.head.appendChild(el); return el;
    })();
    const teal = `oklch(0.71 0.13 ${t.tealHue})`;
    const tealDeep = `oklch(0.56 0.12 ${t.tealHue})`;
    s.textContent = `:root{--tribe-teal:${teal};--tribe-teal-deep:${tealDeep}}`;
  }, [t.tealHue]);

  // Route: #/report → report page (stub for now)
  if (hash.startsWith('#/report')) {
    return <ReportStub/>;
  }

  return (
    <>
      <window.DesignCanvas>
        <window.DCSection id="landing" title="Compound · Landing" subtitle="Two directions — Founders-faithful + Turquoise-forward product">
          <window.DCArtboard id="A" label="A · Editorial sky" width={1440} height={1080} style={{ background: 'transparent', boxShadow: 'none' }}>
            <LandingShell which="A"/>
          </window.DCArtboard>
          <window.DCArtboard id="B" label="B · Turquoise product" width={1440} height={1080} style={{ background: 'transparent', boxShadow: 'none' }}>
            <LandingShell which="B"/>
          </window.DCArtboard>
        </window.DCSection>
      </window.DesignCanvas>

      <window.TweaksPanel>
        <window.TweakSection label="Palette"/>
        <window.TweakSlider label="Teal hue" value={t.tealHue} min={160} max={210} step={1} unit="°"
          onChange={v=>setTweak('tealHue', v)}/>
        <window.TweakSection label="Brain"/>
        <window.TweakToggle label="Activation pulse" value={t.brainPulse}
          onChange={v=>setTweak('brainPulse', v)}/>
        <window.TweakToggle label="Fixation box on scan" value={t.showScanHighlight}
          onChange={v=>setTweak('showScanHighlight', v)}/>
      </window.TweaksPanel>
    </>
  );
}

function ReportStub() {
  const T = window.TRIBE;
  return (
    <div className="tb-root" style={{
      position:'fixed', inset:0, background: T.wash, display:'flex', alignItems:'center', justifyContent:'center',
      padding:40,
    }}>
      <div className="tb-env"/>
      <div className="tb-glass-deep" style={{padding:40, borderRadius:18, maxWidth:620, textAlign:'center', position:'relative', zIndex:2}}>
        <div className="tb-eyebrow">Report · Coming next pass</div>
        <h2 className="tb-display" style={{fontSize:54, margin:'12px 0 14px', letterSpacing:'-0.02em'}}>
          Analysis complete.
        </h2>
        <p style={{color:T.inkSoft, fontSize:15, lineHeight:1.55, maxWidth:440, margin:'0 auto'}}>
          The report page (site sections with side-by-side brain magnification loupes,
          emotion decoding, and actionable edits) will land in the next iteration.
          This stub confirms the pipeline → report handoff works.
        </p>
        <button onClick={()=>{ window.location.hash=''; }} className="tb-glass-btn"
          style={{all:'unset',cursor:'pointer',marginTop:24,padding:'11px 22px',borderRadius:999,fontSize:13.5,color:'#F4F7FB'}}>
          ← Back to landing
        </button>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
