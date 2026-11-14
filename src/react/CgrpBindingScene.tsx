import { memo } from 'react'
import type { Intervention, Sample } from '../core/index.js'
import { cgrpReleaseLevel } from '../core/pathway.js'
import coordinates from './data/6e3y.json' with { type: 'json' }
import binding from './data/cgrp-binding.json' with { type: 'json' }

type Point = { x: number; y: number; depth: number }
type Chain = keyof typeof coordinates

const clamp = (value: number) => Math.max(0, Math.min(1, value))
const cycle = (value: number) => value - Math.floor(value)
const mix = (a: number, b: number, t: number) => a + (b - a) * t
const smooth = (t: number) => t * t * (3 - 2 * t)
const rotation = Math.PI / 12
const cosine = Math.cos(rotation)
const sine = Math.sin(rotation)

function project([x, y, z]: readonly number[]): Point {
  const dx = x - 86
  const dz = z - 94
  return { x: 230 + 3.55 * (dx * cosine + dz * sine), y: 211 - 2.29 * (y - 100), depth: dz * cosine - dx * sine }
}

function curve(points: readonly Point[]) {
  let path = 'M' + points[0].x.toFixed(1) + ' ' + points[0].y.toFixed(1)
  for (let index = 1; index < points.length - 1; index++) {
    const point = points[index]
    const next = points[index + 1]
    path += 'Q' + point.x.toFixed(1) + ' ' + point.y.toFixed(1) + ' '
      + ((point.x + next.x) / 2).toFixed(1) + ' ' + ((point.y + next.y) / 2).toFixed(1)
  }
  const last = points[points.length - 1]
  return path + 'L' + last.x.toFixed(1) + ' ' + last.y.toFixed(1)
}

function traceChain(chain: Chain) {
  const parts: { path: string; helix: boolean; depth: number; chain: Chain; key: string }[] = []
  let segment: Point[] = []
  let lastHelix = -1
  let lastResidue: number | undefined
  function append() {
    if (segment.length < 2) return
    parts.push({
      path: curve(segment), helix: lastHelix >= 0, chain, key: chain + parts.length,
      depth: segment.reduce((sum, point) => sum + point.depth, 0) / segment.length,
    })
  }

  for (const [residue, ...xyz] of coordinates[chain]) {
    const point = project(xyz)
    const helix = binding.helices[chain].findIndex(([first, last]) => residue >= first && residue <= last)
    if (lastResidue !== undefined && (residue - lastResidue > 1 || helix !== lastHelix)) {
      const previous = segment.at(-1)!
      append()
      segment = residue - lastResidue > 1 ? [] : [previous]
    }
    segment.push(point)
    lastResidue = residue
    lastHelix = helix
  }
  append()
  return parts
}

const receptor = [...traceChain('R'), ...traceChain('E')].sort((a, b) => b.depth - a.depth)
const peptide = traceChain('P')
const pocket = project(binding.pocket)
const membrane = Array.from({ length: 33 }, (_, index) => ({
  x: 8 + index * 13.5,
  offset: Math.sin(index * 2.6) * 2.3,
}))
const branches = [
  'M236 237C234 261 200 267 191 290S159 310 137 311',
  'M236 237C236 265 224 275 231 299S224 316 212 327',
  'M236 237C245 263 264 267 267 291S292 311 318 318',
  'M236 237C248 259 279 257 294 276S332 296 360 291',
]
const messengers = Array.from({ length: 9 }, (_, index) => ({
  phase: cycle(index * .618),
  x: 59 + index * 10.2,
  y: 37 + cycle(index * .37) * 64,
  angle: (cycle(index * .71) - .5) * 102,
}))
const atomColor: Record<string, string> = { C: '#a0c7ab', N: '#95c8ef', O: '#ffb2a0', F: '#f2e3a7' }

const ReceptorBody = memo(function ReceptorBody() {
  return <g fill="none" strokeLinecap="round" strokeLinejoin="round">
    {receptor.map(({ path, helix, chain, depth, key }) => {
      const width = helix ? 8.4 : 4.1
      const clr = chain === 'R'
      const front = clamp((16 - depth) / 38)
      return <g key={key}>
        <path d={path} stroke="#182a26" strokeWidth={width + 2.1} />
        <path d={path} stroke={clr ? '#b37d64' : '#719784'} strokeWidth={width} opacity={.72 + front * .28} />
        <path d={path} stroke={clr ? '#edb892' : '#bed8b5'} strokeWidth={width * .37} opacity={.25 + front * .48}
          transform="translate(-.65 -.8)" />
      </g>
    })}
  </g>
})

const DrugMolecule = memo(function DrugMolecule() {
  return <>
    <g strokeLinecap="round" fill="none">
      {binding.drug.bonds.map(([from, to, order]) => {
        const [x1, y1] = binding.drug.atoms[from]
        const [x2, y2] = binding.drug.atoms[to]
        const dx = Number(x2) - Number(x1)
        const dy = Number(y2) - Number(y1)
        const length = Math.hypot(dx, dy)
        return <g key={from + '-' + to}>
          <path d={`M${x1} ${y1}L${x2} ${y2}`} stroke="#20392e" strokeWidth="4.2" />
          <path d={`M${x1} ${y1}L${x2} ${y2}`} stroke="#a5ceb0" strokeWidth="1.8" />
          {order === 2 && length > 0 && <path d={`M${x1} ${y1}L${x2} ${y2}`}
            transform={`translate(${-dy / length * 2.7} ${dx / length * 2.7})`} stroke="#9cc6a9" strokeWidth="1.2" />}
        </g>
      })}
    </g>
    {binding.drug.atoms.map(([x, y, element], index) =>
      <circle key={index} cx={x} cy={y} r={element === 'C' ? 1.65 : 2.5} fill={atomColor[element]} stroke="#294034" strokeWidth=".55" />,
    )}
  </>
})

const Membrane = memo(function Membrane({ fill }: { fill: string }) {
  return <g>
    <path className="mw-rx-bilayer" d="M0 142H450V222H0Z" fill={fill} />
    <path d="M0 141H450M0 223H450" stroke="#97a58a" opacity=".16" />
    <g fill="none" stroke="#a6a584" strokeWidth="1.12" opacity=".47">
      {membrane.map(({ x, offset }, index) => <path key={x} d={`M${x - 1.5} ${145 + offset}q-2 8 1 13t-1 16m4-29q2 10 0 14t1 14
        M${x - 1.5} ${219 - offset}q-2 -8 1 -13t-1 -16m4 29q2-10 0-14t1-14`} opacity={.56 + cycle(index * .41) * .44} />)}
    </g>
    <g fill="#929a77" stroke="#bac19b" strokeWidth=".75">
      {membrane.map(({ x, offset }) => <g key={x}><ellipse cx={x} cy={144 + offset} rx="3.6" ry="2.9" /><ellipse cx={x} cy={220 - offset} rx="3.6" ry="2.9" /></g>)}
    </g>
  </g>
})

export function CgrpBindingScene({ id, sample, treatment, progress, zoom }: {
  id: string; sample: Sample; treatment: Intervention; progress: number; zoom: number
}) {
  const signal = clamp(sample.cgrpSignal * 1.35)
  const free = clamp(sample.freeCgrp * 1.6 + sample.releasedCgrp * .09)
  const occupation = clamp(sample.cgrpOccupied * 1.55)
  const approach = smooth(progress)
  const antagonist = progress > 0 && treatment === 'ubrogepant'
  const antibody = progress > 0 && treatment === 'galcanezumab'
  const triptan = treatment === 'sumatriptan'
  const seated = antagonist && progress === 1
  const status = triptan ? progress === 1 ? 'Sumatriptan activates the serotonin receptor upstream of CGRP release'
    : 'Sumatriptan target on the CGRP-releasing nerve' :
    seated ? 'Ubrogepant is at the binding pocket' : antagonist ? 'Ubrogepant approaches the binding pocket'
    : antibody ? 'Antibody captures CGRP outside the receptor' : occupation > .05 ? 'CGRP is binding to the receptor' : 'Receptor waiting for CGRP'
  const halo = 'url(#' + id + '-halo)'
  const field = 'url(#' + id + '-field)'
  const bilayer = 'url(#' + id + '-bilayer)'
  const medicineX = mix(318, pocket.x, approach)
  const medicineY = mix(40, pocket.y, approach) - 18 * Math.sin(approach * Math.PI)
  const captured = clamp(sample.freeCgrp * sample.engagement * 9)
  const camera = smooth(zoom)
  const magnified = zoom > .65
  const viewBox = [triptan ? 0 : 108 * camera, 7 * camera, mix(450, 243, camera), mix(330, 178.2, camera)].join(' ')

  return <svg className="mw-rx-scene" viewBox={viewBox} role="img" aria-label={status}
    data-binding={triptan && progress > 0 ? progress === 1 ? 'serotonin-bound' : 'serotonin-approaching' :
      seated ? 'bound' : antagonist ? 'approaching' : antibody ? 'capture' : 'untreated'}>
    <defs>
      <radialGradient id={id + '-field'} cx=".54" cy=".27" r=".75">
        <stop stopColor="#30463b" /><stop offset="1" stopColor="#14241f" />
      </radialGradient>
      <linearGradient id={id + '-bilayer'} x2="0" y2="1">
        <stop stopColor="#64745a" stopOpacity=".34" /><stop offset=".48" stopColor="#374737" stopOpacity=".7" /><stop offset="1" stopColor="#64745a" stopOpacity=".31" />
      </linearGradient>
      <radialGradient id={id + '-halo'}>
        <stop stopColor="#fff0a3" stopOpacity=".62" /><stop offset="1" stopColor="#f1b770" stopOpacity="0" />
      </radialGradient>
      <pattern id={id + '-grid'} width="16" height="16" patternUnits="userSpaceOnUse">
        <circle cx="1" cy="1" r=".66" fill="#a3b5a2" opacity=".22" />
      </pattern>
    </defs>
    <g className="mw-rx-backdrop" aria-hidden="true">
      <rect width="450" height="330" fill={field} />
      <rect width="450" height="330" fill={'url(#' + id + '-grid)'} />
    </g>
    <Membrane fill={bilayer} />
    <g aria-hidden="true">
      <circle cx="235" cy="254" r={22 + signal * 21} fill={halo} opacity={signal * .79} />
      {branches.map((path, index) => <g key={path} fill="none" strokeLinecap="round">
        <path d={path} stroke="#8d815b" strokeWidth="1.6" opacity=".34" />
        <path d={path} stroke="#fed38a" strokeWidth={1.5 + signal * 3.5} opacity={signal * .86} pathLength="100"
          strokeDasharray={`${5 + signal * 17} ${32 - signal * 8}`} strokeDashoffset={-sample.time * 15 + index * 7} />
      </g>)}
      <ReceptorBody />
      <g opacity={occupation} fill="none" strokeLinecap="round" strokeLinejoin="round">
        {peptide.map(({ path, key }) => <g key={key}>
          <path d={path} stroke="#473120" strokeWidth="7.1" />
          <path d={path} stroke="#f1b974" strokeWidth="4.9" />
          <path d={path} stroke="#ffe5a5" strokeWidth="1.65" transform="translate(-.4 -.65)" />
        </g>)}
      </g>
      {messengers.map(({ phase, x, y, angle }, index) => {
        const progress = cycle(sample.time * .26 + phase)
        const t = smooth(progress)
        const detour = antagonist ? clamp((approach - .65) / .35) * clamp((progress - .54) * 3.5) : 0
        const px = mix(x, pocket.x - 10, t) - detour * 68
        const py = mix(y, pocket.y - 4, t) + Math.sin(progress * Math.PI) * (12 + index % 4 * 5) - detour * 29
        const opacity = clamp(free * 2.4 - index * .135) * Math.min(1, progress * 9, (1 - progress) * 8)
        return <g key={phase} transform={`translate(${px} ${py}) rotate(${angle})`} opacity={opacity}>
          <path d="M-7 4C-6-2-3-4 0-1S5 4 8-2" fill="none" stroke="#332d22" strokeWidth="5.4" strokeLinecap="round" />
          <path d="M-7 4C-6-2-3-4 0-1S5 4 8-2" fill="none" stroke="#f6c483" strokeWidth="2.65" strokeLinecap="round" />
          <circle cx="-6" cy="3.3" r="2" fill="#ffe5a5" />
        </g>
      })}
      <circle cx={pocket.x} cy={pocket.y} r="23" fill={seated ? '#a8e3bd' : '#ecbd87'} fillOpacity={seated ? '.2' : '.035'}
        stroke={seated ? '#b6ebc4' : '#e2c193'} strokeOpacity={seated ? '.94' : '.63'}
        strokeWidth={seated ? '1.8' : '1.1'} strokeDasharray={seated ? undefined : '3 5'} />
      {antagonist && <g transform={`translate(${medicineX} ${medicineY}) rotate(${-28 * (1 - approach)})`}
        opacity={Math.min(1, .45 + approach * 1.8)}>
        <circle r="25" fill="#335344" opacity=".64" />
        <DrugMolecule />
      </g>}
      {antibody && <g transform={`translate(${mix(324, 305, approach)} ${mix(72, 91, approach)}) rotate(-23)`} opacity={.55 + approach * .45}>
        <path d="M0 19V-2M0-2L-15-21M0-2L15-21" fill="none" stroke="#30483a" strokeWidth="12" strokeLinecap="round" />
        <path d="M-2 18V-2M-2-2L-16-22M2 18V-2M2-2L16-22" fill="none" stroke="#afcfb8" strokeWidth="3" strokeLinecap="round" />
        <path d="M-24-19q5-10 10-5t8-3" fill="none" stroke="#ffd492" strokeWidth="3.7" strokeLinecap="round" opacity={captured} />
      </g>}
    </g>
    {triptan && <g className="mw-triptan-inset" aria-hidden="true">
      <rect x="8" y="7" width="156" height="110" rx="4" />
      <text x="16" y="28">Serotonin receptor</text>
      <text x="16" y="46">5-HT₁B/₁D</text>
      <path className="mw-triptan-membrane" d="M18 84h71M18 103h71" />
      <path className="mw-triptan-receptor" d="M30 107V80q0-18 10-18t11 18v18q0 13 10 13t10-13V77q0-15 10-15" />
      {progress > 0 && <g transform={`translate(${mix(112, 42, approach)} ${mix(54, 72, approach)})`}>
        <circle className="mw-triptan-halo" r={11 + sample.engagement * 8} opacity={.3 + sample.engagement * .7} />
        <path className="mw-triptan-drug" d="M-6 0-3-5h6l3 5-3 5h-6Z" />
      </g>}
      <text x="87" y="77">CGRP</text>
      <text x="87" y="94">released</text>
      <path className="mw-triptan-release-track" d="M89 106h60" />
      <path className="mw-triptan-release" d={`M89 106h${60 * cgrpReleaseLevel(sample.releasedCgrp)}`} />
    </g>}
    <g className="mw-rx-annotation" data-magnified={magnified} aria-hidden="true">
      {!magnified && !triptan && <text x="15" y="24">Outside cell</text>}
      <path d={magnified ? `M${pocket.x + 21} ${pocket.y - 9}l30 -22h26` : `M${pocket.x + 21} ${pocket.y - 9}l39 -22h33`} />
      <text x={pocket.x + (magnified ? 52 : 99)} y={pocket.y - (magnified ? 38 : 27)}>Binding pocket</text>
      {!magnified && <>
        <path d="M20 181h54l47-16h24" />
        <text x="15" y="172">Cell membrane</text>
        <text x="15" y="307">Inside cell</text>
      </>}
    </g>
  </svg>
}
