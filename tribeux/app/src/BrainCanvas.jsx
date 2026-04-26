import { useEffect, useRef } from 'react'
import * as THREE from 'three'

// =========================================================================
// TRIBE v2-style cortical activation render.
// Ported from tribeux/frontend/src/BrainCanvas.jsx.
// =========================================================================

const FSAVG_URL = '/assets/fsaverage5.glb'

const HOT_STOPS = [
  [1.00, 0.98, 0.90],
  [1.00, 0.96, 0.55],
  [1.00, 0.82, 0.18],
  [1.00, 0.55, 0.06],
  [0.88, 0.18, 0.04],
  [0.52, 0.04, 0.02],
]
const HOT_LUT = (() => {
  const N = 256, out = new Float32Array(N * 3)
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1)
    const seg = t * (HOT_STOPS.length - 1)
    const lo = Math.floor(seg), hi = Math.min(HOT_STOPS.length - 1, lo + 1)
    const f = seg - lo, a = HOT_STOPS[lo], b = HOT_STOPS[hi]
    out[i*3    ] = a[0] + (b[0]-a[0])*f
    out[i*3 + 1] = a[1] + (b[1]-a[1])*f
    out[i*3 + 2] = a[2] + (b[2]-a[2])*f
  }
  return out
})()

const BASE_COLOR = [0.96, 0.94, 0.91]

async function loadFsavg(url) {
  const buf = await (await fetch(url)).arrayBuffer()
  const dv = new DataView(buf)
  if (dv.getUint32(0, true) !== 0x46546C67) throw new Error('not glb')
  const jsonLen = dv.getUint32(12, true)
  const json = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 20, jsonLen)))
  const binStart = 20 + jsonLen + 8
  const bvSlice = i => {
    const bv = json.bufferViews[i]
    return new Uint8Array(buf, binStart + (bv.byteOffset || 0), bv.byteLength)
  }
  const prim = json.meshes[0].primitives[0]
  const posAcc = json.accessors[prim.attributes.POSITION]
  const idxAcc = json.accessors[prim.indices]
  const posBytes = bvSlice(posAcc.bufferView)
  const idxBytes = bvSlice(idxAcc.bufferView)
  const positions = new Float32Array(posBytes.buffer, posBytes.byteOffset, posAcc.count * 3)
  const indices = new Uint32Array(idxBytes.buffer, idxBytes.byteOffset, idxAcc.count)
  return { positions, indices, count: posAcc.count }
}

function buildParcels() {
  const parcels = []
  const lobes = [
    { name:'prefrontal', yawDeg:[50, 90],  pitchDeg:[5,  45], count:2 },
    { name:'frontal',    yawDeg:[10, 50],  pitchDeg:[20, 60], count:2 },
    { name:'motor',      yawDeg:[-5, 15],  pitchDeg:[35, 65], count:1 },
    { name:'parietal',   yawDeg:[-55,-15], pitchDeg:[25, 65], count:2 },
    { name:'occipital',  yawDeg:[-100,-65],pitchDeg:[-5, 30], count:2 },
    { name:'temporal',   yawDeg:[-25, 45], pitchDeg:[-45,-5], count:2 },
  ]
  ;[-1, 1].forEach(side => {
    lobes.forEach(L => {
      for (let i = 0; i < L.count; i++) {
        const yaw   = (L.yawDeg[0]   + Math.random()*(L.yawDeg[1]-L.yawDeg[0]))   * Math.PI/180
        const pitch = (L.pitchDeg[0] + Math.random()*(L.pitchDeg[1]-L.pitchDeg[0])) * Math.PI/180
        const x = side * Math.max(0.3, Math.cos(pitch) * Math.cos(Math.abs(yaw)*0.45))
        const y = Math.sin(yaw) * Math.cos(pitch)
        const z = Math.sin(pitch)
        const v = new THREE.Vector3(x, y, z).normalize()
        parcels.push({
          region: L.name, side: side < 0 ? 'L' : 'R', pos: v,
          radius:   0.28 + Math.random()*0.14,
          state: 'quiet', phase: 0, intensity: 0,
          peak:     0.75 + Math.random()*0.25,
          rise:     1.2  + Math.random()*1.4,
          hold:     0.5  + Math.random()*0.7,
          fall:     2.0  + Math.random()*2.0,
          cooldown: 7    + Math.random()*9,
          timer:    Math.random() * 14,
        })
      }
    })
  })
  return parcels
}

const easeOutCubic = t => 1 - Math.pow(1 - t, 3)
const easeInCubic  = t => t * t * t

function stepParcels(parcels, dt) {
  for (const p of parcels) {
    p.timer -= dt
    if (p.state === 'quiet') {
      if (p.timer <= 0) { p.state = 'building'; p.phase = 0 }
    } else if (p.state === 'building') {
      p.phase += dt / p.rise
      if (p.phase >= 1) { p.phase = 0; p.state = 'peak'; p.intensity = p.peak }
      else p.intensity = easeOutCubic(p.phase) * p.peak
    } else if (p.state === 'peak') {
      p.phase += dt / p.hold
      p.intensity = p.peak * (0.92 + 0.08*Math.sin(p.phase * 8))
      if (p.phase >= 1) {
        p.phase = 0; p.state = 'fading'
        const cands = parcels.filter(q => q !== p && q.state === 'quiet' && p.pos.dot(q.pos) > 0.60)
        cands.sort(() => Math.random()-0.5)
        if (cands.length && Math.random() < 0.35) {
          cands[0].timer = Math.min(cands[0].timer, 1.5 + Math.random()*2)
        }
      }
    } else if (p.state === 'fading') {
      p.phase += dt / p.fall
      p.intensity = p.peak * (1 - easeInCubic(p.phase))
      if (p.phase >= 1) {
        p.phase = 0; p.state = 'quiet'; p.intensity = 0
        p.timer = p.cooldown + Math.random()*3
      }
    }
  }
}

function buildVertexDirs(positions, count) {
  let cx=0, cy=0, cz=0
  for (let i=0; i<count; i++) { cx+=positions[i*3]; cy+=positions[i*3+1]; cz+=positions[i*3+2] }
  cx/=count; cy/=count; cz/=count
  const out = new Float32Array(count*3)
  for (let i=0; i<count; i++) {
    const x=positions[i*3]-cx, y=positions[i*3+1]-cy, z=positions[i*3+2]-cz
    const len = Math.hypot(x, y, z) || 1
    out[i*3]=x/len; out[i*3+1]=y/len; out[i*3+2]=z/len
  }
  return out
}

function writeColors(dirs, colors, parcels, count, brightness) {
  for (let i=0; i<count; i++) {
    const nx=dirs[i*3], ny=dirs[i*3+1], nz=dirs[i*3+2]
    let act = 0
    for (let j=0; j<parcels.length; j++) {
      const P = parcels[j]
      if (P.intensity < 0.015) continue
      const dot = nx*P.pos.x + ny*P.pos.y + nz*P.pos.z
      const d = 1 - dot
      const falloff = Math.exp(-(d*d) / (P.radius*P.radius*0.18))
      act += P.intensity * falloff
    }
    act = Math.min(1, act) * brightness

    if (act < 0.14) {
      colors[i*3  ] = BASE_COLOR[0]
      colors[i*3+1] = BASE_COLOR[1]
      colors[i*3+2] = BASE_COLOR[2]
    } else {
      const t  = Math.min(1, (act - 0.14) / 0.86)
      const tt = Math.pow(t, 1.1)
      const idx = Math.min(255, (tt*255)|0)
      const mix = Math.min(1, 0.08 + 1.05*tt)
      colors[i*3  ] = BASE_COLOR[0]*(1-mix) + HOT_LUT[idx*3  ]*mix
      colors[i*3+1] = BASE_COLOR[1]*(1-mix) + HOT_LUT[idx*3+1]*mix
      colors[i*3+2] = BASE_COLOR[2]*(1-mix) + HOT_LUT[idx*3+2]*mix
    }
  }
}

export default function BrainCanvas({
  width = 360,
  height = 360,
  autoRotate = true,
  interactive = false,
  brightness = 1,
  initRotX = -93,
  initRotY = 4,
}) {
  const mountRef = useRef(null)
  const groupRef = useRef(null)

  useEffect(() => {
    const g = groupRef.current
    if (!g) return
    g.rotation.set(initRotX * Math.PI/180, initRotY * Math.PI/180, 0)
  }, [initRotX, initRotY])

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(32, width/height, 0.1, 1000)
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(width, height)
    renderer.setClearColor(0x000000, 0)
    renderer.physicallyCorrectLights = true
    mount.appendChild(renderer.domElement)

    scene.add(new THREE.AmbientLight(0xffeedd, 0.38))
    const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(3, 5, 5); scene.add(key)
    const fill = new THREE.DirectionalLight(0xffd8b0, 0.55); fill.position.set(-3, -1, 2); scene.add(fill)
    const rim = new THREE.DirectionalLight(0xc8e8ff, 0.30); rim.position.set(-2, 4, -5); scene.add(rim)
    const top = new THREE.DirectionalLight(0xffffff, 0.60); top.position.set(0, 8, 1); scene.add(top)

    const group = new THREE.Group()
    groupRef.current = group
    scene.add(group)
    const worldY = new THREE.Vector3(0, 1, 0)

    let raf = 0, disposed = false
    let geo = null, mat = null, parcels = null, dirs = null, count = 0

    ;(async () => {
      try {
        const { positions, indices, count: c } = await loadFsavg(FSAVG_URL)
        if (disposed) return
        count = c
        geo = new THREE.BufferGeometry()
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
        geo.setIndex(new THREE.BufferAttribute(indices, 1))
        const colors = new Float32Array(count*3)
        for (let i=0; i<count; i++) {
          colors[i*3]=BASE_COLOR[0]; colors[i*3+1]=BASE_COLOR[1]; colors[i*3+2]=BASE_COLOR[2]
        }
        geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
        geo.computeVertexNormals()
        geo.computeBoundingSphere()

        mat = new THREE.MeshStandardMaterial({
          vertexColors: true,
          roughness: 0.50,
          metalness: 0.04,
          flatShading: false,
        })
        const mesh = new THREE.Mesh(geo, mat)
        const bb = geo.boundingSphere
        const s = 1.18 / bb.radius
        mesh.scale.setScalar(s)
        mesh.position.set(-bb.center.x*s, -bb.center.y*s, -bb.center.z*s)

        group.rotation.x = initRotX * Math.PI/180
        group.rotation.y = initRotY * Math.PI/180
        group.add(mesh)

        dirs = buildVertexDirs(positions, count)
        parcels = buildParcels()

        camera.position.set(0, 0.08, 4.0)
        camera.lookAt(0, 0, 0)
      } catch (err) {
        console.error('Brain load failed', err)
      }
    })()

    let dragging = false, lastX = 0, lastY = 0
    const onDown = e => { dragging = true; lastX = e.clientX; lastY = e.clientY; renderer.domElement.style.cursor = 'grabbing' }
    const onUp   = () => { dragging = false; if (renderer.domElement) renderer.domElement.style.cursor = 'grab' }
    const onMove = e => {
      if (!dragging) return
      group.rotation.z += (e.clientX - lastX)*0.006
      group.rotation.x += (e.clientY - lastY)*0.006
      lastX = e.clientX; lastY = e.clientY
    }
    if (interactive) {
      renderer.domElement.style.cursor = 'grab'
      renderer.domElement.addEventListener('pointerdown', onDown)
      window.addEventListener('pointerup', onUp)
      window.addEventListener('pointermove', onMove)
    }

    let last = performance.now()
    const tick = () => {
      const now = performance.now()
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now

      if (geo && parcels && dirs) {
        stepParcels(parcels, dt)
        const col = geo.attributes.color.array
        writeColors(dirs, col, parcels, count, brightness)
        geo.attributes.color.needsUpdate = true
      }

      if (autoRotate && !dragging) group.rotateOnWorldAxis(worldY, dt * 0.16)
      renderer.render(scene, camera)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      disposed = true
      groupRef.current = null
      cancelAnimationFrame(raf)
      if (interactive) {
        renderer.domElement.removeEventListener('pointerdown', onDown)
        window.removeEventListener('pointerup', onUp)
        window.removeEventListener('pointermove', onMove)
      }
      if (geo) geo.dispose()
      if (mat) mat.dispose()
      renderer.dispose()
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement)
    }
  }, [width, height, autoRotate, interactive, brightness, initRotX, initRotY])

  return <div ref={mountRef} style={{ width, height, position: 'relative' }} />
}
