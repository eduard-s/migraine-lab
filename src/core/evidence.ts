import type { Intervention, Pathway, Target } from './parameters.js'

export type Source = { label: string; url: string }

export interface Treatment {
  id: Exclude<Intervention, 'none'>
  name: string
  className: string
  status: 'Acute treatment' | 'Preventive treatment' | 'Investigational' | 'Past trial'
  pathway: Pathway
  target: Target
  mechanism: string
  evidence: string
  sources: readonly Source[]
}

export const TREATMENTS: readonly Treatment[] = [
  {
    id: 'ubrogepant', name: 'Ubrogepant', className: 'Gepant', status: 'Acute treatment', pathway: 'cgrp', target: 'receptor',
    mechanism: 'Competes with CGRP for its receptor. The model shows less signaling inside the receiving cell.',
    evidence: 'Approved in the U.S. for acute migraine treatment in adults. In cells expressing the human receptor, ubrogepant reduced CGRP-stimulated cAMP, a signal inside the cell.',
    sources: [
      { label: 'U.S. prescribing information', url: 'https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=36106b14-d410-4faf-a361-2871de8198c3' },
      { label: 'Human receptor experiment', url: 'https://pubmed.ncbi.nlm.nih.gov/31992609/' },
    ],
  },
  {
    id: 'sumatriptan', name: 'Sumatriptan', className: 'Triptan', status: 'Acute treatment', pathway: 'cgrp', target: 'release',
    mechanism: 'Activates serotonin 5-HT₁B/₁D receptors. The lab models one proposed effect, less CGRP release from the sensory nerve.',
    evidence: 'Approved in the U.S. for acute migraine treatment in adults. Prescribing information describes inhibition of neuropeptide release and effects on cranial blood vessels.',
    sources: [{ label: 'U.S. prescribing information', url: 'https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=584abe73-8290-4484-ff8e-5890831c095e' }],
  },
  {
    id: 'galcanezumab', name: 'Galcanezumab', className: 'CGRP antibody', status: 'Preventive treatment', pathway: 'cgrp', target: 'messenger',
    mechanism: 'Binds the CGRP messenger. The receiving cell has less free CGRP available to activate its receptors.',
    evidence: 'Approved in the U.S. for migraine prevention in adults. The lab illustrates binding in a single comparison. Prevention trials measure migraine frequency over a longer period.',
    sources: [{ label: 'U.S. prescribing information', url: 'https://www.accessdata.fda.gov/drugsatfda_docs/label/2026/761063s013lbl.pdf' }],
  },
  {
    id: 'bocunebart', name: 'Bocunebart', className: 'PACAP antibody', status: 'Investigational', pathway: 'pacap', target: 'messenger',
    mechanism: 'Binds the PACAP messenger. The model lowers free PACAP upstream of PAC1 and other PACAP-responsive receptors.',
    evidence: 'The peer-reviewed Phase 2a HOPE trial reported fewer monthly migraine days than placebo. The sponsor subsequently reported a positive Phase 2b PROCEED result. Bocunebart remains investigational.',
    sources: [
      { label: 'Phase 2a HOPE trial', url: 'https://doi.org/10.1056/NEJMoa2314577' },
      { label: 'Phase 2b sponsor report', url: 'https://mb.cision.com/Main/18215/4357979/4134818.pdf' },
    ],
  },
  {
    id: 'amg301', name: 'AMG 301', className: 'PAC1 receptor antibody', status: 'Past trial', pathway: 'pacap', target: 'receptor',
    mechanism: 'Targets the PAC1 receptor. The lab illustrates the proposed blockade of one PACAP-responsive receptor.',
    evidence: 'The Phase 2 migraine prevention trial found no efficacy benefit over placebo. It is a case where the proposed molecular mechanism and the observed clinical outcome differ.',
    sources: [{ label: 'Phase 2 trial results', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC7786389/' }],
  },
]

export const ANATOMY_EVIDENCE = [
  { label: 'Human Reference Atlas brain geometry · CC BY 4.0', url: 'https://humanatlas.io/3d-reference-library' },
  { label: 'Trigeminal ganglion and divisions on human MRI', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC8158638/' },
  { label: 'Trigeminal signaling in a mouse model', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC8813987/' },
  { label: 'Human fMRI observations during visual aura', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC31895/' },
  { label: 'CGRP receptor with bound CGRP · PDB 6E3Y', url: 'https://www.rcsb.org/structure/6E3Y' },
  { label: 'PAC1 receptor with bound PACAP38 · PDB 6M1I', url: 'https://www.rcsb.org/structure/6M1I' },
]

export const TARGET_LABELS: Record<Target, string> = {
  release: 'Release from the nerve',
  messenger: 'Free messenger',
  receptor: 'Receptor',
}

export const TRIGGER_EVIDENCE: readonly Source[] = [
  { label: 'NIH guide to migraine triggers', url: 'https://www.ninds.nih.gov/sites/default/files/2025-07/NINDS_Headache_Booklet_Digital_508c%20%281%29.pdf' },
  { label: 'Weather and migraine diary study', url: 'https://pubmed.ncbi.nlm.nih.gov/25642431/' },
  { label: 'Daily diary study of individual migraine triggers', url: 'https://pubmed.ncbi.nlm.nih.gov/33022773/' },
]

export function findTreatment(id: Intervention) {
  return TREATMENTS.find(treatment => treatment.id === id)
}
