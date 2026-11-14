# Migraine Lab

Follow a modeled migraine from visual aura to drug binding and recovery. The 2D pathway starts automatically, and the treated run and its untreated reference share one clock.

## Run locally

Requires Node.js 22.12 or newer.

    npm ci
    npm run dev

Open the address printed by Vite. The app runs in the browser.

Select **Compare sumatriptan and ubrogepant** to see both drugs alongside the untreated attack. Each column shows the binding site above the head cutaway. **Shared treatment time** changes both start times, and one playback slider updates CGRP, nerve pulses, and pain across all three columns. Select a milestone below the heads to pause all three runs at that time.

1. Start with the cortical wave and her view of the aura. Follow the pulses on the head map from the meninges through the brainstem relay to the thalamus. The dashed line marks the possible link between aura and meningeal activity.
2. Select a location on the head map or a station tab to inspect it and adjust its biology. **Tissue patch** lets you probe or poke individual cells. Use **Follow sequence** to resume automatic station changes.
3. The view moves back to the meningeal nerve ending. Choose sumatriptan to see a triptan reduce CGRP release, ubrogepant (Ubrelvy) to see a gepant block the CGRP receptor, or galcanezumab to see an antibody bind free CGRP. **Replay binding** repeats that section.
4. The view pulls back to both heads. Follow the same nerve paths in each run and compare the brainstem and thalamus readouts as the pulses fade. The pain curves continue on the same clock.
5. Set **Treatment time** early and select **Pin treatment run**. Move the slider later to see the pinned, current, and untreated runs together. **Replay comparison** in recovery rewinds all three to just before the earlier treatment. The chart marks both treatment times and reports when pain stays at or below 2.5 out of 100. Changing the attack or pain pathway settings clears the pin so the runs share the same conditions.
6. In **Pain recovery**, select a point on the shared timeline to pause all heads at the modeled binding milestone, the end of brainstem pulses, or when pain stays settled. Brainstem quiet follows the final relay burst and lets the last displayed pulse reach the thalamus. Each milestone uses model time.

With reduced motion, the pathway opens on a still frame. Use **Next moment** to step through the same sequence.

## Embed the lab

Install the published package in your React project.

    npm install @esmirnov.ai/migraine-lab

To test a local build, run `npm pack` in this repository and install the resulting archive from your app directory.

The package root and /react export the React 18.2–19 component. The /core entry runs in Node without React or a browser. The component styles are scoped to the lab. Host apps can map the --ml-surface, --ml-paper, --ml-ink, --ml-clay, and --ml-font variables.

    import { MigraineLab } from '@esmirnov.ai/migraine-lab'
    import '@esmirnov.ai/migraine-lab/styles.css'

    export function Lab() {
      return <MigraineLab
        initialTrigger="weather"
        initialFactors={{ aura: true, recoverySpeed: 65 }}
      />
    }

Pathway opens by default. It shows a female cutaway with visual aura enabled and a compressed treatment response. Use `initialTreatment` to start with `sumatriptan`, `ubrogepant` (the default), or `galcanezumab`. Use `initialTrigger`, `initialFactors`, and `playbackRate` to configure the run. `className` applies to the lab wrapper.

Pass `initialMode="walkthrough"` for the six-view cutaway with manual pinning, or `initialMode="explore"` for the trigger catalog, WebGL anatomy, full treatment list, and CSV export. `initialBody`, `initialScale`, `initialHeadRegion`, and `initialPathway` apply to Explore.

    import { compareEpisode, episodeCsv, FACTORS, sampleAt } from '@esmirnov.ai/migraine-lab/core'

    const episode = compareEpisode({
      trigger: 'weather',
      treatment: 'ubrogepant',
      factors: { intensity: 80, aura: true, recoverySpeed: 65, start: 15 },
    })

    const atTime30 = sampleAt(episode.treated, 30)
    const csv = episodeCsv(episode)

Use FACTORS for every numeric setting’s label, description, bounds, and unit. Use DEFAULT_FACTORS, createFactors, TRIGGERS, and TREATMENTS for defaults and available examples. Set aura to a boolean. Model times are relative units.

## Model and sources

The Pathway uses a dimensionless cortex grid alongside the existing trigeminal pain episode. The dashed connection marks uncertainty about whether the cortical wave starts headache in people. Turning aura off keeps the model's pain input active. The relay and thalamus are illustrative extensions of that input. [Human aura recording](https://pubmed.ncbi.nlm.nih.gov/40055980/), [Meningeal nerve recordings in rats](https://pmc.ncbi.nlm.nih.gov/articles/PMC2907647/), [Light and headache study](https://pmc.ncbi.nlm.nih.gov/articles/PMC2818758/).

Reported triggers vary by person. The model assigns each example a brief, sustained, or gradual exposure and an illustrative onset. Intensity, background conditions, sensitivity, and the threshold determine whether the exposure starts a modeled attack. [NIH headache guide](https://www.ninds.nih.gov/sites/default/files/2025-07/NINDS_Headache_Booklet_Digital_508c%20%281%29.pdf), [Daily diary study](https://pubmed.ncbi.nlm.nih.gov/33022773/).

Two messenger pulses drive the modeled nerve signal. Cell signaling and symptoms use relative units. Recovery speed changes how quickly the modeled symptoms settle. The optional aura wave has independent onset, speed, and recovery controls. It illustrates one visual aura pattern. [Human fMRI observations of visual aura](https://pmc.ncbi.nlm.nih.gov/articles/PMC31895/).

Each treatment changes one modeled step. Clinical approval and trial evidence appear beside the mechanism. Simulated effects are qualitative. [Ubrogepant prescribing information](https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=36106b14-d410-4faf-a361-2871de8198c3), [PACAP antibody trial](https://doi.org/10.1056/NEJMoa2314577), [AMG 301 trial](https://pmc.ncbi.nlm.nih.gov/articles/PMC7786389/).

The live lab uses schematic drawings. The vessel illustrates a possible response to CGRP. Explore uses the Human Reference Atlas adult brain and deposited coordinates for the receptor views. [Vascular imaging study](https://pubmed.ncbi.nlm.nih.gov/21416486/), [Anatomy and structure credits](ANATOMY.md).

## Verify

    npm test
    npm run typecheck
    npm run test:package
    npm run build:demo
