// LandingB.jsx — Variation B (preferred): Turquoise product, dense, Space Grotesk.

function LandingB({ onSubmit, analyzing, url, setUrl }) {
  const T = window.TRIBE;
  const time = React.useMemo(() => new Date().toLocaleTimeString('en-US',{hour12:false}), []);
  return (
    <div className="tb-root" style={{
      position:'relative', width:'calc(100% - 32px)', height:'calc(100% - 32px)', 
      margin: '16px auto', borderRadius: 20, overflow:'hidden',
      border: '1px solid rgba(10,22,40,0.06)',
      boxShadow: '0 30px 90px -20px rgba(10,22,40,0.2), 0 0 1px rgba(10,22,40,0.1)',
      background:`
        radial-gradient(ellipse 70% 50% at 80% 20%, rgba(127,222,211,0.38), transparent 60%),
        radial-gradient(ellipse 60% 60% at 10% 90%, rgba(15,181,168,0.22), transparent 65%),
        linear-gradient(180deg, #D6E8E7 0%, #C5DDDE 50%, #E6EEF5 100%)
      `,
    }}>
      <div className="tb-grain"/>

      {/* Top nav */}
      <div style={{
        position:'absolute', top:24, left:'50%', transform:'translateX(-50%)', zIndex:20,
      }} className="tb-glass">
        <div style={{padding:'9px 10px 9px 16px', borderRadius:999, display:'flex', alignItems:'center', gap:18}}>
          <div style={{display:'flex',alignItems:'center',gap:8, fontFamily:T.fUI, fontSize:13.5, fontWeight:600, letterSpacing:'-0.02em'}}>
            <window.BrandMark size={18}/>
            Compound
            <span style={{fontFamily:T.fMono, fontSize:9.5, color:T.inkMute, marginLeft:4, padding:'2px 5px', border:`1px dotted ${T.hairStrong}`, borderRadius:3}}>v2.3</span>
          </div>
          <div style={{width:1, height:14, background:T.hair}}/>
          <div style={{display:'flex', gap:18, fontSize:13, color:T.inkSoft, fontWeight:400}}>
            <span>How it works</span>
            <span>Destrieux atlas</span>
            <span>Research</span>
            <span>Pricing</span>
          </div>
          <div style={{width:1, height:14, background:T.hair}}/>
          <button style={{
            all:'unset', cursor:'pointer',
            padding:'6px 14px', borderRadius:999, fontSize:12.5, fontWeight:500,
            background:T.ink, color:'#fff', fontFamily:T.fUI,
            boxShadow:'inset 0 1px 0 rgba(255,255,255,0.15), 0 4px 12px -2px rgba(10,22,40,0.3)',
          }}>Request access ↗</button>
        </div>
      </div>

      {/* Main content */}
      <div style={{position:'absolute', inset:0, padding:'84px 48px 32px'}}>
        <div style={{
          width:'100%', height:'100%',
          display:'grid', gridTemplateRows:'auto 1fr auto', gap:14,
        }}>
          {/* Status strip */}
          <div className="tb-rise tb-rise-1" style={{
            display:'flex', justifyContent:'space-between', alignItems:'center',
            fontFamily:T.fMono, fontSize:11, color:T.inkSoft,
          }}>
            <div style={{display:'flex',gap:22, alignItems:'center'}}>
              <span style={{display:'flex',alignItems:'center',gap:6}}>
                <span style={{width:6,height:6,borderRadius:'50%',background:T.teal,boxShadow:`0 0 6px ${T.tealGlow}`, animation:'tb-blink 1.8s ease-in-out infinite'}}/>
                Tribe v2 · online
              </span>
              <span>Model 87m · fMRI-grounded</span>
              <span>Destrieux · 148 parcels</span>
              <span>Latency 1.8s / page</span>
            </div>
            <span>Session #{Math.floor(Math.random()*9000+1000)} · {time}</span>
          </div>

          {/* Hero split */}
          <div style={{
            display:'grid', gridTemplateColumns:'0.85fr 1.4fr', gap:32, alignItems:'stretch',
          }}>
            {/* LEFT column */}
            <div style={{display:'flex', flexDirection:'column', justifyContent:'flex-start', gap:32}}>
              <div>
                <div className="tb-rise tb-rise-2" style={{display:'flex',alignItems:'center',gap:8, marginBottom:18}}>
                  <span className="tb-glass" style={{
                    padding:'4px 10px 4px 6px', borderRadius:999, fontSize:11.5, display:'flex', alignItems:'center', gap:6,
                    fontFamily:T.fUI, color:T.ink,
                  }}>
                    <span style={{padding:'1px 6px', background:T.teal, color:'#fff', borderRadius:999, fontSize:10, fontWeight:600, letterSpacing:'0.02em'}}>New</span>
                    Destrieux emotional decoding, shipped
                    <span style={{color:T.inkMute}}>↗</span>
                  </span>
                </div>

                <h1 className="tb-display tb-rise tb-rise-2" style={{
                  fontSize:'clamp(40px, 5.2vw, 84px)', margin:0, color:T.ink, fontWeight:500,
                }}>
                  Your interface,<br/>
                  rendered by a<br/>
                  <span style={{color:T.tealDeep}}>cortex.</span>
                </h1>

                <p className="tb-rise tb-rise-3" style={{
                  marginTop:18, maxWidth:500, fontSize:14.5, lineHeight:1.55, color:T.inkSoft,
                }}>
                  Compound pushes your page through <b style={{color:T.ink,fontWeight:500}}>Tribe v2</b> — a neural encoder
                  trained on human fMRI — then derives perturbation maps, decodes emotion via the
                  Destrieux atlas, and ranks concrete copy and layout edits by their effect on
                  attention, affect, and comprehension.
                </p>
              </div>

              {/* Input card */}
              <div className="tb-rise tb-rise-4">
                <div className="tb-glass-deep" style={{
                  borderRadius:14, padding:12, display:'flex', flexDirection:'column', gap:10,
                }}>
                  <div style={{
                    display:'flex', alignItems:'center', gap:10,
                    padding:'11px 14px',
                    background:'rgba(255,255,255,0.62)',
                    border:'0.5px solid rgba(255,255,255,0.85)',
                    borderRadius:10,
                  }}>
                    <span style={{fontFamily:T.fMono, fontSize:11, color:T.tealDeep, letterSpacing:'0.02em'}}>https://</span>
                    <input className="tb-input"
                      placeholder="airbnb.com"
                      value={url} onChange={e=>setUrl(e.target.value)}
                      onKeyDown={e=>{ if (e.key==='Enter') onSubmit(); }}
                      disabled={analyzing}
                      style={{flex:1, fontSize:16}}/>
                    <span style={{fontFamily:T.fMono,fontSize:10,color:T.inkMute,letterSpacing:'0.02em'}}>⌘↵</span>
                  </div>
                  <div style={{display:'flex', gap:10, alignItems:'center', justifyContent:'space-between'}}>
                    <div style={{display:'flex',gap:5}}>
                      {[
                        {l:'Desktop', on:true},
                        {l:'Mobile'},
                        {l:'Full scroll'},
                        {l:'Above fold'},
                      ].map((c,i)=>(
                        <span key={c.l} style={{
                          padding:'5px 10px', borderRadius:999, fontSize:11,
                          background: c.on ? T.ink : 'rgba(255,255,255,0.55)',
                          color: c.on ? '#fff' : T.inkSoft,
                          border: c.on ? 'none' : '0.5px solid rgba(255,255,255,0.8)',
                          fontFamily:T.fUI,
                        }}>{c.l}</span>
                      ))}
                    </div>
                    <button onClick={onSubmit} disabled={analyzing} style={{
                      all:'unset', cursor:'pointer', borderRadius:10, padding:'8px 16px',
                      fontSize:13, fontWeight:500, fontFamily:T.fUI,
                      background:'linear-gradient(180deg,#0FB5A8 0%,#0E8F86 100%)',
                      color:'#fff',
                      boxShadow:'inset 0 1px 0 rgba(255,255,255,0.35), 0 6px 16px -4px rgba(14,143,134,0.5)',
                    }}>
                      {analyzing ? 'Analyzing…' : 'Run Compound  →'}
                    </button>
                  </div>
                </div>

                <div style={{display:'flex',gap:10,marginTop:10,fontFamily:T.fMono,fontSize:10.5,color:T.inkMute,letterSpacing:'0.02em',alignItems:'center'}}>
                  <span>try →</span>
                  {['airbnb.com','stripe.com','nytimes.com','linear.app','notion.so'].map(d=>(
                    <span key={d} onClick={()=>setUrl(d)} style={{cursor:'pointer',color:T.inkSoft,borderBottom:`1px dotted ${T.hairStrong}`,padding:'1px 0'}}>{d}</span>
                  ))}
                </div>
              </div>

              {/* Metrics row */}
              <div className="tb-rise tb-rise-5" style={{
                display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10,
              }}>
                <Metric label="avg Δ-affect" value="+0.18" foot="across 1.2k sites" trend="up"/>
                <Metric label="model r²" value="0.71" foot="fMRI held-out"/>
                <Metric label="sites scanned" value="38,204" foot="last 30 days"/>
                <Metric label="parcels" value="148" foot="Destrieux atlas"/>
              </div>
            </div>

            {/* RIGHT column — brain scan */}
            <div style={{position:'relative'}} className="tb-rise tb-rise-4">
              <div className="tb-glass-deep" style={{
                position:'absolute', inset:0, borderRadius:18, overflow:'hidden',
              }}>
                {/* Top chrome */}
                <div style={{position:'absolute', top:10, left:14, right:14,
                  display:'flex', justifyContent:'space-between', alignItems:'center',
                  fontFamily:T.fMono, fontSize:10.5, color:T.inkSoft, zIndex:5}}>
                  <div style={{display:'flex',gap:6,alignItems:'center'}}>
                    <span style={{width:6,height:6,borderRadius:'50%',background:'#E04949',animation:'tb-blink 1.4s ease-in-out infinite'}}/>
                    <b style={{color:T.ink,fontWeight:500}}>rec</b>
                    <span style={{marginLeft:6}}>live scan · airbnb.com</span>
                  </div>
                  <span>TR 2.0s · TE 30ms · 3T</span>
                </div>

                {/* Bottom chrome */}
                <div style={{position:'absolute', bottom:10, left:14, right:14,
                  display:'flex', justifyContent:'space-between', alignItems:'center',
                  fontFamily:T.fMono, fontSize:10, color:T.inkSoft, zIndex:5}}>
                  <div className="tb-tick-row">
                    {Array.from({length:24}).map((_,i)=>(
                      <div key={i} className={`tb-tick ${i%5===2 || i%7===3 ? 'on':''}`}/>
                    ))}
                  </div>
                  <span>t = +{(Math.random()*6).toFixed(2)}s · hrf-corrected</span>
                </div>

                <div style={{position:'absolute', inset:'36px 14px 36px'}}>
                  <window.HeroScan tilt={20} brainSize={250}>
                    <div style={{ width: 1180 }}>
                      <window.AirbnbSite/>
                    </div>
                  </window.HeroScan>
                </div>

                <div style={{position:'absolute',inset:0,pointerEvents:'none',
                  backgroundImage:`repeating-linear-gradient(0deg, transparent 0, transparent 3px, rgba(10,22,40,0.015) 3px, rgba(10,22,40,0.015) 4px)`}}/>
              </div>
            </div>
          </div>

          {/* Footer strip with legend + logos */}
          <div className="tb-rise tb-rise-6">
            <hr className="tb-div" style={{marginBottom:10}}/>
            <div style={{
              display:'flex', justifyContent:'space-between', alignItems:'center',
              fontSize:12, color:T.inkSoft, fontFamily:T.fUI,
            }}>
              <div style={{display:'flex',alignItems:'center',gap:14}}>
                <span style={{color:T.inkMute, fontFamily:T.fMono, fontSize:10.5}}>activation →</span>
                <ColorLegend/>
              </div>
              <div style={{display:'flex',alignItems:'center',gap:18}}>
                <span style={{color:T.inkMute}}>Used by</span>
                {['Linear','Framer','Mercury','Arc','Vercel','Retool'].map((b,i)=>(
                  <span key={b} style={{fontWeight:500,color:T.ink,letterSpacing:'-0.01em',opacity:0.85}}>{b}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {analyzing && <window.AnalysisOverlay url={url}/>}
    </div>
  );
}

function Metric({ label, value, foot, trend }) {
  const T = window.TRIBE;
  return (
    <div className="tb-glass" style={{borderRadius:10, padding:'10px 12px'}}>
      <div style={{fontFamily:T.fMono, fontSize:10, color:T.inkMute, letterSpacing:'0.02em'}}>{label}</div>
      <div style={{fontFamily:T.fDisplay, fontSize:24, marginTop:2, color:T.ink, letterSpacing:'-0.02em', fontWeight:500}}>
        {value} {trend==='up' && <span style={{fontSize:13, color:T.tealDeep}}>↑</span>}
      </div>
      {foot && <div style={{fontFamily:T.fMono, fontSize:9.5, color:T.inkMute, letterSpacing:'0.02em', marginTop:2}}>{foot}</div>}
    </div>
  );
}

function ColorLegend() {
  const T = window.TRIBE;
  return (
    <div style={{display:'flex',alignItems:'center',gap:6}}>
      <div style={{width:140, height:8, borderRadius:2,
        background:'linear-gradient(90deg, #D8E6EC 0%, #F8EFC8 30%, #F9B64A 55%, #E86B1F 78%, #8E1F0C 100%)'}}/>
      <span style={{fontFamily:T.fMono, fontSize:10, color:T.inkMute}}>low</span>
      <span style={{flex:1}}/>
      <span style={{fontFamily:T.fMono, fontSize:10, color:T.inkMute, marginLeft:110, position:'absolute'}}></span>
    </div>
  );
}

function BrandMark({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <defs>
        <linearGradient id="bm" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#0FB5A8"/>
          <stop offset="100%" stopColor="#0A1628"/>
        </linearGradient>
      </defs>
      <circle cx="10" cy="10" r="8.5" stroke="url(#bm)" strokeWidth="1.2"/>
      <path d="M4 10 Q 6 6, 10 6 Q 14 6, 16 10 Q 14 14, 10 14 Q 6 14, 4 10 Z" fill="url(#bm)" opacity="0.18"/>
      <circle cx="10" cy="10" r="2.2" fill="#0FB5A8"/>
    </svg>
  );
}

window.LandingB = LandingB;
window.BrandMark = BrandMark;
window.Metric = Metric;
