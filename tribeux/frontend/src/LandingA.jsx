// LandingA.jsx — Variation A: editorial sky (Space Grotesk, sentence case, denser).

function LandingA({ onSubmit, analyzing, url, setUrl }) {
  const T = window.TRIBE;
  const [rotX, setRotX] = React.useState(-93);
  const [rotY, setRotY] = React.useState(4);
  return (
    <div className="tb-root" style={{
      position:'relative', width:'calc(100% - 32px)', height:'calc(100% - 32px)', 
      margin: '16px auto', borderRadius: 20, overflow:'hidden', background: '#F7F8FA',
      border: '1px solid rgba(10,22,40,0.06)',
      boxShadow: '0 30px 90px -20px rgba(10,22,40,0.2), 0 0 1px rgba(10,22,40,0.1)',
    }}>
      <div className="tb-grain"/>

      {/* Top bar */}
      <div style={{
        position:'absolute', top:0, left:0, right:0, padding:'24px 40px',
        display:'flex', justifyContent:'space-between', alignItems:'flex-start', zIndex:10,
      }}>
        <div style={{fontFamily:T.fUI, fontSize:12.5, lineHeight:1.15, letterSpacing:'-0.01em'}}>
          <div style={{fontWeight:600,display:'flex',alignItems:'center',gap:6}}>
            <window.BrandMark size={16}/> Compound
          </div>
          <div style={{color:T.inkMute, marginTop:2}}>Neural UX analysis<sup style={{fontSize:8,marginLeft:2}}>™</sup></div>
        </div>
        <div style={{display:'flex', gap:26, fontSize:13, color:T.ink}}>
          <span>Method</span><span>Atlas</span><span>Research</span><span>Log in</span>
          <span style={{
            padding:'4px 12px', borderRadius:999, background:T.ink, color:'#fff', fontSize:12.5,
          }}>Get access ↗</span>
        </div>
      </div>

      {/* Status strip */}
      <div style={{
        position:'absolute', top:72, left:40, right:40, zIndex:8,
        display:'flex', justifyContent:'space-between', alignItems:'center',
        fontFamily:T.fMono, fontSize:10.5, color:T.inkMute,
      }} className="tb-rise tb-rise-1">
        <div style={{display:'flex',gap:20,alignItems:'center'}}>
          <span style={{display:'flex',alignItems:'center',gap:6}}>
            <span style={{width:6,height:6,borderRadius:'50%',background:T.teal, animation:'tb-blink 1.8s ease-in-out infinite'}}/>
            Tribe v2 online
          </span>
          <span>Model 87m</span>
          <span>Destrieux · 148 parcels</span>
        </div>
      </div>

      {/* Hero */}
      <div style={{
        position:'absolute', inset:0, display:'grid',
        gridTemplateColumns:'minmax(0,0.85fr) minmax(0,1.4fr)',
        padding:'110px 48px 40px', gap:40,
      }}>
        {/* LEFT */}
        <div style={{display:'flex', flexDirection:'column', justifyContent:'flex-start', gap: 32, zIndex:5}}>
          <div>
            <h1 className="tb-display tb-rise tb-rise-2" style={{
              fontSize:'clamp(48px, 6.2vw, 104px)', margin:0, color:T.ink, fontWeight:500,
              lineHeight: 1.05,
            }}>
              <span style={{ whiteSpace: 'nowrap' }}>See your site</span><br/>
              through a<br/>
              <span style={{color:T.tealDeep}}>human</span><br/>
              brain.
            </h1>

            <p className="tb-rise tb-rise-3" style={{
              marginTop:18, maxWidth:500, fontSize:15.5, lineHeight:1.55, color:T.inkSoft,
            }}>
              Compound runs an out-of-distribution neural model against your page,
              estimates cortical activation across the Destrieux atlas, and returns
              a perturbation-grounded critique of what your interface makes people <i>feel</i>.
            </p>
          </div>

          <div className="tb-rise tb-rise-4" style={{maxWidth:560}}>
            <div className="tb-glass" style={{
              borderRadius:999, padding:'10px 10px 10px 22px',
              display:'flex', alignItems:'center', gap:10,
            }}>
              <svg width="16" height="16" viewBox="0 0 16 16" style={{flexShrink:0,color:T.inkMute}}>
                <path d="M3 8a5 5 0 0 1 10 0 5 5 0 0 1-10 0z M1 8h2 M13 8h2 M8 1v2 M8 13v2" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
              </svg>
              <input className="tb-input"
                placeholder="paste a url to analyze   e.g. airbnb.com"
                value={url} onChange={e=>setUrl(e.target.value)}
                onKeyDown={e=>{ if (e.key==='Enter') onSubmit(); }}
                disabled={analyzing}
                style={{flex:1}}/>
              <button onClick={onSubmit} disabled={analyzing} style={{
                all:'unset', cursor:'pointer', borderRadius:999, padding:'10px 20px',
                fontSize:13.5, fontWeight:500, fontFamily:T.fUI,
                background:'linear-gradient(180deg,#0FB5A8 0%,#0E8F86 100%)',
                color:'#fff',
                boxShadow:'inset 0 1px 0 rgba(255,255,255,0.35), 0 10px 24px -6px rgba(14,143,134,0.5)',
              }}>
                {analyzing ? 'Analyzing…' : 'Run analysis  ↗'}
              </button>
            </div>
            <div style={{display:'flex',gap:12,marginTop:12,fontFamily:T.fMono,fontSize:10.5,color:T.inkMute,letterSpacing:'0.02em'}}>
              <span>try →</span>
              {['airbnb.com','stripe.com','nytimes.com','linear.app'].map(d=>(
                <span key={d} onClick={()=>setUrl(d)} style={{cursor:'pointer',borderBottom:`1px dotted ${T.hairStrong}`, color:T.inkSoft}}>{d}</span>
              ))}
            </div>
          </div>

          <div className="tb-rise tb-rise-6" style={{
            display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14,
          }}>
            <window.Metric label="avg Δ-affect" value="+0.18" foot="across 1.2k sites" trend="up"/>
            <window.Metric label="model r²" value="0.71" foot="fMRI held-out"/>
            <window.Metric label="latency" value="1.8s" foot="per page"/>
          </div>
        </div>

        {/* RIGHT */}
        <div style={{position:'relative', paddingRight: 10}} className="tb-rise tb-rise-3">
          <window.HeroScan tilt={18} brainSize={200} brainRotX={rotX} brainRotY={rotY}>
            <div style={{ width: 1180 }}>
              <window.AirbnbSite/>
            </div>
          </window.HeroScan>

          <div style={{
            position:'absolute', right:8, bottom:40, zIndex:4,
            fontFamily:T.fMono, fontSize:10, color:T.ink, letterSpacing:'0.02em',
            padding:'10px 14px', borderRadius:8, minWidth:160,
          }} className="tb-glass">
            <div style={{display:'flex',justifyContent:'space-between',gap:24}}>
              <span style={{color:T.inkMute}}>fixation</span><span>0.71</span>
            </div>
            <div style={{display:'flex',justifyContent:'space-between',gap:24,marginTop:4}}>
              <span style={{color:T.inkMute}}>affect +</span><span style={{color:T.tealDeep}}>+0.12</span>
            </div>
            <div style={{display:'flex',justifyContent:'space-between',gap:24,marginTop:4}}>
              <span style={{color:T.inkMute}}>confusion</span><span style={{color:'#C43A3A'}}>0.34</span>
            </div>
          </div>
        </div>
      </div>

      {analyzing && <window.AnalysisOverlay url={url}/>}
    </div>
  );
}

function AnalysisOverlay({ url }) {
  const T = window.TRIBE;
  return (
    <div style={{
      position:'absolute', inset:0, zIndex:100,
      display:'flex', alignItems:'center', justifyContent:'center',
      background:'rgba(230,238,245,0.55)',
      animation:'tb-rise .4s ease both',
    }}>
      <div className="tb-glass-deep" style={{
        width:560, padding:'26px 28px 22px', borderRadius:18,
      }}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
          <div>
            <div className="tb-eyebrow">Compound · live</div>
            <div style={{fontFamily:T.fDisplay, fontSize:26, marginTop:4, letterSpacing:'-0.025em', fontWeight:500}}>
              Scanning <span style={{color:T.tealDeep}}>{url || 'site'}</span>
            </div>
          </div>
          <div style={{width:54,height:54,position:'relative'}}>
            <div style={{position:'absolute',inset:0,borderRadius:'50%',border:`1px solid ${T.hairStrong}`}}/>
            <div style={{position:'absolute',inset:4,borderRadius:'50%',
              background:`conic-gradient(from 0deg, ${T.teal}, transparent 60%)`,
              animation:'tb-orb-rotate 1.6s linear infinite'}}/>
            <div style={{position:'absolute',inset:10,borderRadius:'50%',background:T.wash}}/>
          </div>
        </div>
        <window.PipelineStages url={url || 'airbnb.com'} onDone={() => {
          setTimeout(()=> window.location.hash = '#/report', 400);
        }}/>
      </div>
    </div>
  );
}

window.LandingA = LandingA;
window.AnalysisOverlay = AnalysisOverlay;
