import { findTreatment, type Intervention, type Sample } from '../core/index.js'
import { cgrpReleaseLevel } from '../core/pathway.js'
import { treatmentTargetTime } from './workbench-episode.js'

const points = (value: number) => Math.round(value * 100)

export function bindingProgress(sample: Sample, time: number, exposure: number, engagement: number) {
  const duration = treatmentTargetTime(exposure, engagement) - exposure
  return sample.engagement > 0 ? Math.max(0, Math.min(1, (time - exposure) / duration)) : 0
}

export function bindingStatus(treatment: Intervention, progress: number, canEngage: boolean, boundBeforeView = false) {
  if (treatment === 'none') return 'No treatment'
  if (!canEngage) return 'No target engagement'
  if (progress === 0) return 'Before binding'
  if (treatment === 'sumatriptan') return progress < 1 ? 'Approaching serotonin receptor' : 'Serotonin receptor active'
  if (treatment === 'galcanezumab') return 'Targets free CGRP'
  if (progress < 1) return 'Approaching pocket'
  return boundBeforeView ? 'Already at the pocket' : 'At binding pocket'
}

export function SignalReadout({ sample, label, showRelease }: { sample: Sample; label: string; showRelease: boolean }) {
  const signal = points(sample.cgrpSignal)
  return <div className="mw-rx-measures">
    <div className="mw-rx-strength">
      <span>CGRP cell signal</span>
      <div><output aria-live="off" aria-label={label + ' cell signal'}>{signal}</output><small> / 100</small></div>
      <meter min={0} max={100} value={signal} aria-label={label + ' signal level'} />
    </div>
    <div className="mw-rx-occupancy">
      <span>CGRP bound</span><output aria-live="off" aria-label={label + ' CGRP occupancy'}>{points(sample.cgrpOccupied)}%</output>
    </div>
    {showRelease && <div className="mw-rx-release">
      <span>CGRP released</span><div><output aria-live="off" aria-label={label + ' CGRP released'}>
        {points(cgrpReleaseLevel(sample.releasedCgrp))}
      </output><small> / 100</small></div>
    </div>}
  </div>
}

export function BindingSources({ treatments }: { treatments: readonly Intervention[] }) {
  return <details className="mw-rx-sources">
    <summary>Binding structures and model sources</summary>
    <p>The receptor and bound CGRP use a 2D projection of human cryo-EM coordinates. CLR and RAMP1 form the receptor. The pocket is located using a telcagepant crystal structure. Ubrogepant’s chemical structure is drawn from PubChem. Its path and pose illustrate the mechanism, and signal and timing use model units.</p>
    {treatments.includes('sumatriptan') && <p>The inset illustrates a serotonin receptor on the CGRP-releasing nerve. Its location and binding animation are schematic.</p>}
    {treatments.map(treatment => {
      const details = findTreatment(treatment)
      return details && <p key={treatment}>{details.evidence} <a href={details.sources[0].url}
        target="_blank" rel="noreferrer">{details.sources[0].label}</a></p>
    })}
    <div className="mw-rx-links">
      <a href="https://www.rcsb.org/structure/6E3Y" target="_blank" rel="noreferrer">Receptor · 6E3Y</a>
      <a href="https://www.rcsb.org/structure/3N7R" target="_blank" rel="noreferrer">Pocket · 3N7R</a>
      <a href="https://pubchem.ncbi.nlm.nih.gov/compound/68748835" target="_blank" rel="noreferrer">Ubrogepant structure</a>
      <a href="https://pubmed.ncbi.nlm.nih.gov/31992609/" target="_blank" rel="noreferrer">Ubrogepant receptor assay</a>
    </div>
  </details>
}
