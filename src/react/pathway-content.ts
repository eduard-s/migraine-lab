import type { PathwaySettings } from '../core/pathway.js'

type NumericSetting = Exclude<keyof PathwaySettings, 'nmdaBlock' | 'darkRoom'>
export type PathwayFactor = 'cgrp' | 'clearance' | 'receptors' | 'recoverySpeed'
export type PathwayControl = { key: NumericSetting | PathwayFactor; label: string; effect: string }
export type Station = 'cortex' | 'meninges' | 'relay' | 'thalamus'

export const stations: readonly { id: Station; name: string; question: string; controls: readonly PathwayControl[]; lesson: string }[] = [
  {
    id: 'cortex', name: 'Cortex', question: 'How does a local disturbance spread?',
    controls: [
      { key: 'glutamate', label: 'Glutamate release', effect: 'More messenger from each activated cell helps the wave spread.' },
      { key: 'cleanup', label: 'Astrocyte cleanup', effect: 'Clears potassium and glutamate faster and shortens the quiet period.' },
      { key: 'interneuron', label: 'Interneuron drive', effect: 'Raises the background potassium level in this model.' },
      { key: 'nmda', label: 'NMDA response', effect: 'Changes how strongly neighbouring cells respond to glutamate.' },
      { key: 'energy', label: 'Energy supply', effect: 'Gives cells more energy to restore their ion gradients.' },
    ],
    lesson: 'Potassium and glutamate raise the activity of neighbouring cells. The wave leaves a quiet patch while cells recover.',
  },
  {
    id: 'meninges', name: 'Meninges', question: 'What happens when a nerve ending releases CGRP?',
    controls: [
      { key: 'cgrp', label: 'CGRP release', effect: 'Changes how much messenger leaves the nerve ending.' },
      { key: 'clearance', label: 'Messenger clearance', effect: 'Clears free CGRP from the space around the ending.' },
      { key: 'receptors', label: 'CGRP receptors', effect: 'Changes how strongly the receiving cell responds to the same CGRP.' },
    ],
    lesson: 'Compare a receptor blocker with an antibody that captures free CGRP. The model also carries a separate PACAP signal to the relay.',
  },
  {
    id: 'relay', name: 'Brainstem relay', question: 'When can a light touch become painful?',
    controls: [
      { key: 'windUp', label: 'Sensitisation', effect: 'Raises relay gain faster while input from the meninges is active.' },
      { key: 'brake', label: 'Descending brake', effect: 'Dampens the outgoing signal for the same input.' },
      { key: 'touch', label: 'Test touch', effect: 'Brushes the scalp in the model and shows the response separately.' },
      { key: 'relayRecovery', label: 'Gain recovery', effect: 'Returns the relay to its resting gain faster after the input drops.' },
    ],
    lesson: 'As the relay becomes more sensitive, the same light brush can produce a larger response.',
  },
  {
    id: 'thalamus', name: 'Thalamus', question: 'How can light add to head pain?',
    controls: [
      { key: 'light', label: 'Light level', effect: 'Raises retinal input to the circuit processing head pain.' },
      { key: 'thalamicGain', label: 'Thalamic gain', effect: 'Amplifies the combined output for the same incoming signals.' },
      { key: 'recoverySpeed', label: 'Recovery speed', effect: 'Changes how quickly head pain fades as thalamic output falls.' },
    ],
    lesson: 'Dim the light and watch thalamic output drop while the upstream nerve signal continues.',
  },
]

export const cortexPresets = {
  typical: { label: 'Typical cortex', values: { glutamate: 50, cleanup: 50, interneuron: 50, nmda: 50, energy: 50 } },
  release: { label: 'More glutamate', values: { glutamate: 85, cleanup: 50, interneuron: 50, nmda: 50, energy: 50 } },
  cleanup: { label: 'Slower cleanup', values: { glutamate: 50, cleanup: 15, interneuron: 50, nmda: 50, energy: 50 } },
} as const

export const pathwayExperiments = [
  'Lower Poke strength and try to start a wave.',
  'Compare Typical cortex and Slower cleanup at the same probe.',
  'Reduce NMDA signalling and check how much tissue the wave reaches.',
  'At drug binding, compare the cell signal with a receptor blocker and with no treatment.',
  'At the thalamus, turn on Dark room while the relay signal is high.',
] as const

export const pathwayEvidence = [
  { id: 'cortex', title: 'Cortical wave and visual aura', level: 'Human evidence',
    description: 'Human imaging and a single intracranial recording link spreading cortical activity with visual aura.',
    source: 'Intracranial recording during aura', url: 'https://pubmed.ncbi.nlm.nih.gov/40055980/' },
  { id: 'link', title: 'Cortical wave to meningeal pain', level: 'Debated in people',
    description: 'A wave activated meningeal pain fibres in rats. In this lab the pain episode has its own input and can run with or without a wave.',
    source: 'Rat meningeal recordings', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC2907647/' },
  { id: 'meninges', title: 'CGRP and migraine pain', level: 'Clinical trial',
    description: 'A trial found that blocking the CGRP receptor could relieve migraine pain. The local CGRP animation illustrates one part of this pathway.',
    source: 'CGRP receptor antagonist trial', url: 'https://doi.org/10.1056/NEJMoa030505' },
  { id: 'relay', title: 'Sensitisation and painful touch', level: 'Human observations',
    description: 'Touch sensitivity can increase during an attack. The relay gain illustrates one way that response can build.',
    source: 'Touch thresholds during an attack', url: 'https://pubmed.ncbi.nlm.nih.gov/10908199/' },
  { id: 'route', title: 'Meninges, brainstem, and thalamus', level: 'Animal recordings',
    description: 'Recordings in rats identified brainstem trigeminal neurons that respond to the dura and project to the thalamus. The map shows this route as a schematic projection.',
    source: 'Brainstem recordings and projections', url: 'https://pubmed.ncbi.nlm.nih.gov/9463456/' },
  { id: 'thalamus', title: 'Light input and head pain', level: 'Human and animal evidence',
    description: 'A study linked light to worse headache in people and found retinal and head pain inputs converging in the rat thalamus.',
    source: 'Light and headache study', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC2818758/' },
] as const
