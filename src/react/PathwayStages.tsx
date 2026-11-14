import type { KeyboardEvent, MouseEvent } from 'react'
import type { EpisodeComparison, Sample } from '../core/index.js'
import { CORTEX_COLUMNS, CORTEX_ROWS, type CortexFrame, type PainPathwayFrame, type PathwaySettings } from '../core/pathway.js'
import type { Station } from './pathway-content.js'

const xAt = (index: number) => 72 + index % CORTEX_COLUMNS * 32
const yAt = (index: number) => 91 + Math.floor(index / CORTEX_COLUMNS) * 31

function Marker({ n, x, y, selected }: { n: number; x: number; y: number; selected: number }) {
  return <g className="mp-marker" data-selected={selected === n} transform={`translate(${x} ${y})`}>
    <circle r="12" /><text y=".4" dominantBaseline="central" textAnchor="middle">{n}</text>
  </g>
}

function Signal({ d, level, time, blue = false }: { d: string; level: number; time: number; blue?: boolean }) {
  return <g className={blue ? 'mp-signal mp-intervention' : 'mp-signal'}>
    <path d={d} strokeWidth={1.4 + level * 2} />
    {level > .02 && <path d={d} pathLength="100" strokeWidth={2.2 + level * 4} strokeDasharray="2 12"
      strokeDashoffset={-time * 14} opacity={Math.sqrt(level)} />}
  </g>
}

export function CortexStage({ frame, probe, spark, cursor, selected, onCell, onMove, tool }: {
  frame: CortexFrame; probe: number; spark: number; cursor: number; selected: number;
  onCell: (cell: number) => void; onMove: (cell: number) => void; tool: 'probe' | 'poke'
}) {
  const flow = frame.cells[probe].flow
  function select(event: MouseEvent<SVGSVGElement>) {
    const box = event.currentTarget.getBoundingClientRect()
    const x = (event.clientX - box.x) / box.width * 660
    const y = (event.clientY - box.y) / box.height * 302
    const column = Math.round((x - 72) / 32)
    const row = Math.round((y - 91) / 31)
    if (column < 0 || column >= CORTEX_COLUMNS || row < 0 || row >= CORTEX_ROWS) return
    onCell(row * CORTEX_COLUMNS + column)
  }
  function navigate(event: KeyboardEvent<SVGSVGElement>) {
    const column = cursor % CORTEX_COLUMNS
    const row = Math.floor(cursor / CORTEX_COLUMNS)
    const nextColumn = event.key === 'ArrowLeft' ? column - 1 : event.key === 'ArrowRight' ? column + 1 : column
    const nextRow = event.key === 'ArrowUp' ? row - 1 : event.key === 'ArrowDown' ? row + 1 : row
    if (event.key.startsWith('Arrow')) {
      event.preventDefault()
      onMove(Math.max(0, Math.min(CORTEX_ROWS - 1, nextRow)) * CORTEX_COLUMNS + Math.max(0, Math.min(CORTEX_COLUMNS - 1, nextColumn)))
    }
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault()
      onCell(cursor)
    }
  }

  return <svg className="mp-stage mp-tissue" viewBox="0 0 660 302" role="group" tabIndex={0}
    aria-label={'Cortical tissue. Arrow keys move. Space ' + (tool === 'probe' ? 'places the probe.' : 'applies a local stimulus.')}
    onClick={select} onKeyDown={navigate}>
    <rect x="38" y="65" width="580" height="174" rx="17" fill="#e7ebe1" stroke="#a8b4a4" />
    <text x="50" y="37" className="mp-diagram-label">Cortical tissue</text>
    <text x="608" y="37" textAnchor="end" className="mp-diagram-note">Probe at row {Math.floor(probe / CORTEX_COLUMNS) + 1}, column {probe % CORTEX_COLUMNS + 1}</text>
    <path d="M71 91H584M71 122H584M71 153H584M71 184H584M71 215H584" fill="none" stroke="#b7c0b2" strokeDasharray="2 5" />
    {frame.cells.map((cell, index) => {
      const k = Math.max(0, cell.potassium - .14)
      const glutamate = Math.max(0, cell.glutamate - .02)
      return <g key={index} transform={`translate(${xAt(index)} ${yAt(index)})`} className="mp-tissue-cell" data-state={cell.state}>
        {cell.state !== 'resting' && <circle className="mp-cell-halo" r={cell.state === 'wave' ? 13 : 11} />}
        <path d="M0-8 8 7H-8ZM0 8v6m-5-14-4-3m14 3 4-3" />
        {k > .02 && <circle cx="-10" cy="-9" r={1.5 + k * 3} className="mp-potassium" opacity={Math.min(1, .36 + k)} />}
        {glutamate > .025 && <rect x="7" y="-13" width={2 + glutamate * 4} height={2 + glutamate * 4}
          className="mp-glutamate" opacity={Math.min(1, .4 + glutamate)} />}
      </g>
    })}
    <g className="mp-astrocyte" transform="translate(218 231)">
      <path d="M0-5 2-14 6-6 17-7 9 0 14 8 4 6 0 14-4 7-15 9-9 1-17-3-6-5-5-13Z" /><circle r="3" />
    </g>
    <circle cx="72" cy="215" r="12" fill="none" stroke="#557364" strokeWidth="1.7" />
    <path d="M55 273C150 251 202 284 280 268S438 252 603 272" fill="none" stroke="#d7a99c" strokeWidth={10 * flow} strokeLinecap="round" />
    <path d="M55 273C150 251 202 284 280 268S438 252 603 272" fill="none" stroke="#a25341" strokeWidth={3 * flow} strokeLinecap="round" opacity=".7" />
    <path d={`M${xAt(probe)} ${yAt(probe) - 15}V54`} className="mp-probe-lead" />
    <circle cx={xAt(probe)} cy={yAt(probe)} r="12" className="mp-probe-ring" />
    <path d={`M${xAt(spark)-5} ${yAt(spark)-18}h10m-5-5v10`} className="mp-spark-mark" />
    <circle cx={xAt(cursor)} cy={yAt(cursor)} r="16" className="mp-cell-cursor" />
    <Marker n={1} x={127} y={64} selected={selected} /><Marker n={2} x={218} y={253} selected={selected} />
    <Marker n={3} x={52} y={227} selected={selected} /><Marker n={4} x={507} y={64} selected={selected} />
    <Marker n={5} x={582} y={270} selected={selected} />
  </svg>
}

export function SynapseStage({ frame, probe, selected, blocked }: { frame: CortexFrame; probe: number; selected: number; blocked: boolean }) {
  const cell = frame.cells[probe]
  const particles = Array.from({ length: Math.round(cell.glutamate * 16) }, (_, i) => ({
    x: 209 + (i * 61) % 238, y: 113 + (i * 27) % 90,
  }))
  return <svg className="mp-stage" viewBox="0 0 660 302" role="img" aria-label={'Synapse at the probe. The cell is ' + cell.state + '.'}>
    <path d="M168 0H484V61Q453 122 328 117T168 61Z" className="mp-organ" />
    <path d="M166 302H494V234Q451 193 330 202T166 234Z" className="mp-organ" />
    <path d="M503 113q87-30 135 2v102q-75 12-114-36l-43-18Z" className="mp-glia" />
    {[220, 270, 324, 378, 432].map((x, i) => <g key={x}>
      <circle cx={x} cy={63 + (i % 2) * 15} r="12" className="mp-vesicle" /><circle cx={x} cy={63 + (i % 2) * 15} r="3" className="mp-potassium" />
      <path d={`M${x - 11} 219v-18q11-12 22 0v18`} className={blocked ? 'mp-pocket mp-intervention' : 'mp-pocket'} />
    </g>)}
    {particles.map(({ x, y }) => <rect key={x} x={x} y={y} width="7" height="7" className="mp-glutamate" />)}
    <text x="30" y="59" className="mp-diagram-label">Release</text>
    <text x="42" y="233" className="mp-diagram-label">NMDA</text>
    <text x="516" y="148" className="mp-diagram-label">Astrocyte</text>
    <text x="516" y="171" className="mp-diagram-note">Uptake</text>
    <Marker n={1} x={190} y={99} selected={selected} /><Marker n={2} x={560} y={194} selected={selected} />
    <Marker n={4} x={226} y={215} selected={selected} />
  </svg>
}

function Meninges({ frame, sample, treatment, selected }: {
  frame: PainPathwayFrame; sample: Sample; treatment: EpisodeComparison['treatment']; selected: number
}) {
  const width = 24 + frame.vessel * 28
  const vessel = 'M60 250C162 221 218 250 323 233S482 198 604 225'
  const engagement = sample.engagement
  const particles = Array.from({ length: 18 }, (_, i) => {
    const phase = (frame.time * .34 + i * .617) % 1
    return {
      x: 303 + Math.sin(i * 2.1 + phase * 3) * phase * 158,
      y: 126 + phase * 74,
      opacity: Math.max(0, Math.min(1, (frame.cgrp + frame.release * .4) * 2.4 - i / 17)),
    }
  })
  return <svg className="mp-stage" viewBox="0 0 660 302" role="img" aria-label="Trigeminal nerve ending releasing CGRP near a meningeal blood vessel">
    <path d="M0 42C142 27 223 54 351 37S539 32 660 45M0 274C157 246 238 295 388 267S547 260 660 277"
      fill="none" stroke="#c2cbbc" strokeWidth="1.5" />
    <path d="M0 275C157 247 238 296 388 268S547 261 660 278V302H0Z" fill="#e5e8db" />
    <path d="M37 99C136 64 211 104 261 112Q298 109 322 134Q333 151 312 154Q284 151 263 130C195 119 120 91 37 116Z"
      className={treatment === 'sumatriptan' && engagement > .02 ? 'mp-organ mp-nerve-treated' : 'mp-organ'} />
    <Signal d="M39 108C128 80 210 109 287 129" level={frame.release} time={frame.time} />
    <path d={vessel} fill="none" stroke="#d2a295" strokeWidth={width} strokeLinecap="round" />
    <path d={vessel} fill="none" stroke="#934736" strokeWidth="2.7" strokeLinecap="round" opacity=".72" />
    {particles.map(({ x, y, opacity }, i) => <circle key={i} cx={x} cy={y} r="4.2" className="mp-potassium" opacity={opacity} />)}
    {[238, 303, 369, 438].map((x, i) => {
      const y = 225 - width / 2 - i * 5
      return <g key={x} transform={`translate(${x} ${y})`}>
        <path d="M-9 9V0l9-6 9 6v9" className="mp-pocket" />
        <circle cy="-3" r={2 + sample.cgrpOccupied * 4} className="mp-potassium" opacity={sample.cgrpOccupied} />
        {treatment === 'ubrogepant' && engagement > .03 && <path d="M-7-9 0-13 7-9V0L0 4-7 0Z" className="mp-blue-fill" opacity={.35 + engagement * .65} />}
      </g>
    })}
    {treatment === 'galcanezumab' && engagement > .03 && [365, 400, 432].map((x, i) =>
      <path key={x} d={`M${x} ${138 + i * 9}v-12l-7-8m7 8 8-8`} className="mp-antibody" opacity={.35 + engagement * .65} />)}
    <text x="41" y="71" className="mp-diagram-label">Trigeminal fibre</text>
    <text x="445" y="107" className="mp-diagram-label">CGRP</text>
    <text x="61" y="212" className="mp-diagram-label">Meningeal vessel</text>
    <Marker n={1} x={302} y={111} selected={selected} /><Marker n={2} x={411} y={147} selected={selected} />
    <Marker n={3} x={480} y={201} selected={selected} />
  </svg>
}

function Relay({ frame, settings, selected }: { frame: PainPathwayFrame; settings: PathwaySettings; selected: number }) {
  const touch = settings.touch / 100
  const brake = settings.brake / 100 * (1 - .3 * settings.brainState / 100)
  return <svg className="mp-stage" viewBox="0 0 660 302" role="img" aria-label="Brainstem relay with inputs from the meninges, a test touch, and descending inhibition">
    <path d="M318 71Q418 55 446 140T395 255Q306 272 269 199T318 71Z" className="mp-field" />
    <Signal d="M62 104H163Q205 104 239 139T345 160" level={frame.incoming} time={frame.time} />
    <Signal d="M62 220H166Q213 220 244 190T345 164" level={touch} time={frame.time} />
    <Signal d="M335 48Q381 71 370 115T350 159" level={brake} time={frame.time} blue />
    <Signal d="M351 161H473Q515 161 597 130" level={frame.relay} time={frame.time} />
    <circle cx="350" cy="162" r={32 + (frame.relayGain - 1) * 10} className="mp-ring" opacity={.4 + frame.relay * .5} />
    <path d="M348 136l24 12 3 28-22 16-28-12-3-26Z" className="mp-organ" />
    <circle cx="350" cy="163" r={7 + frame.relay * 8} className="mp-potassium" opacity={.34 + frame.relay * .66} />
    <text x="62" y="82" className="mp-diagram-label">Meninges input</text>
    <text x="62" y="249" className="mp-diagram-label">Scalp touch</text>
    <text x="353" y="35" className="mp-diagram-label">Descending brake</text>
    <text x="479" y="195" className="mp-diagram-label">To thalamus</text>
    <Marker n={1} x={291} y={128} selected={selected} /><Marker n={2} x={389} y={95} selected={selected} />
    <Marker n={3} x={187} y={212} selected={selected} /><Marker n={4} x={354} y={225} selected={selected} />
  </svg>
}

function Thalamus({ frame, settings, selected }: { frame: PainPathwayFrame; settings: PathwaySettings; selected: number }) {
  const light = settings.darkRoom ? 0 : settings.light / 100
  return <svg className="mp-stage" viewBox="0 0 660 302" role="img" aria-label="Thalamic circuit receiving retinal light signals and head pain signals">
    <path d="M309 78C365 60 420 87 437 132C456 183 414 222 357 224C307 228 272 197 266 153C262 112 282 86 309 78Z"
      className="mp-field" />
    <path d="M59 109q33-28 66 0q-33 28-66 0Z" fill={settings.darkRoom ? '#d8e4ed' : '#f3e3bc'} stroke="#6d8072" strokeWidth="1.5" />
    <circle cx="92" cy="109" r="8" className={settings.darkRoom ? 'mp-blue-fill' : 'mp-potassium'} />
    <Signal d="M125 110H205Q248 110 281 137T354 155" level={light} time={frame.time} />
    <Signal d="M69 225H210Q250 225 281 188T353 156" level={frame.relay} time={frame.time} />
    <path d="M327 126q31-21 52 6t-5 50q-37 20-55-4t8-52Z" className="mp-organ" />
    <circle cx="354" cy="155" r={11 + frame.thalamus * 13} className="mp-ring" opacity={.32 + frame.thalamus * .68} />
    <Signal d="M355 154H471Q516 153 600 113" level={frame.thalamus} time={frame.time} />
    <text x="60" y="76" className="mp-diagram-label">Light from the retina</text>
    <text x="66" y="253" className="mp-diagram-label">From brainstem</text>
    <text x="461" y="93" className="mp-diagram-label">Pain output</text>
    <Signal d="M357 157H460Q515 157 598 167" level={frame.visualDrive} time={frame.time} />
    <Signal d="M357 158H452Q508 158 593 215" level={frame.touchSpread} time={frame.time} />
    <text x="510" y="157" className="mp-diagram-label">Visual</text>
    <text x="511" y="248" className="mp-diagram-label">Touch</text>
    <Marker n={1} x={193} y={110} selected={selected} /><Marker n={2} x={389} y={169} selected={selected} />
    <Marker n={3} x={471} y={135} selected={selected} />
  </svg>
}

export function PainStage({ station, frame, sample, episode, settings, selected }: {
  station: Exclude<Station, 'cortex'>; frame: PainPathwayFrame; sample: Sample; episode: EpisodeComparison; settings: PathwaySettings; selected: number
}) {
  if (station === 'meninges') return <Meninges frame={frame} sample={sample} treatment={episode.treatment} selected={selected} />
  if (station === 'relay') return <Relay frame={frame} settings={settings} selected={selected} />
  return <Thalamus frame={frame} settings={settings} selected={selected} />
}
