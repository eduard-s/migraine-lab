# Anatomy and structure credits

## 2D cutaway

The head cutaway and the street scene were generated with ImageGen. The cutaway prompt requested an adult woman's lateral atlas illustration with an exposed hemisphere, skull rim and meninges. The street prompt requested an eye-level photo of a quiet crossing so the simulated aura and glare could visibly obscure the view. The lab draws the nerve, vessel and cortical wave as schematic overlays.

The Pathway map projects the brainstem relay, thalamus, and trigeminal route onto the lateral illustration. The signal animation follows the lab's model clock. The dashed line marks the proposed link between the cortical wave and meningeal activity. [Human brainstem MRI atlas](https://pubmed.ncbi.nlm.nih.gov/33951517/), [Trigeminal pathway recordings in rats](https://pubmed.ncbi.nlm.nih.gov/9463456/), [Rat recordings after a cortical wave](https://pmc.ncbi.nlm.nih.gov/articles/PMC2907647/).

The receptor close-up projects the CLR, RAMP1, and CGRP Cα traces of [6E3Y](https://www.rcsb.org/structure/6E3Y) into a fixed 2D view and uses that entry's helix records to vary ribbon width. The pocket center comes from the telcagepant heavy-atom centroid in [3N7R](https://www.rcsb.org/structure/3N7R), aligned to 6E3Y using the contacting CLR and RAMP1 residues. The displayed ubrogepant molecule uses the 2D coordinates and bonds of [PubChem CID 68748835](https://pubchem.ncbi.nlm.nih.gov/compound/68748835). The approach, pose, membrane and intracellular pulses are schematic. Playback follows relative model time. [Human receptor binding and signaling assay](https://pubmed.ncbi.nlm.nih.gov/31992609/).

## Brain

The bundled brain is adapted from the Human Reference Atlas, *Brain, Female*, v1.4 (Allen Human Brain Atlas), licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The lab selects and groups cortical, cerebellar, and brainstem surfaces, scales and positions them within the teaching head, reduces mesh density, and adds color. Both figures use this reference brain. The animated aura is an illustration on the occipital surface. [Human Reference Atlas 3D Reference Library](https://humanatlas.io/3d-reference-library), [source GLB](https://cdn.humanatlas.io/digital-objects/ref-organ/brain-female/v1.4/assets/3d-allen-f-brain.glb), [Ding et al., 2016](https://doi.org/10.1002/cne.24080).

To rebuild the adapted mesh, download the source GLB and pass it to the Python script. The final two commands use glTF Transform 4.5.1.

    python3 scripts/prepare-brain.py /path/to/3d-allen-f-brain.glb /tmp/migraine-brain.glb
    npx @gltf-transform/cli@4.5.1 simplify /tmp/migraine-brain.glb /tmp/migraine-brain-simplified.glb --ratio 0.23 --error 0.002
    npx @gltf-transform/cli@4.5.1 meshopt /tmp/migraine-brain-simplified.glb src/react/data/human-brain.glb --quantization-volume scene

## Body, nerve, and cell

The clothed figures and head outlines adapt MakeHuman Community CC0 assets. The trigeminal paths depict the three divisions, the ganglion and its connection to the pons. Their courses and the meningeal branches are schematic. The cell model enlarges membranes, receptors, organelles, and messengers for teaching. [MakeHuman license](https://www.makehumancommunity.org/about/license.html), [MakeHuman source assets](https://github.com/makehumancommunity/makehuman/tree/a8bc2d54ff0ac92e78ff71431b1023eda42bf482/makehuman/data), [Trigeminal ganglion MRI study](https://pmc.ncbi.nlm.nih.gov/articles/PMC8158638/).

## Receptors

The molecular views draw selected chains of the experimental structures using deposited Cα coordinates and α-helix annotations. The membrane planes orient the viewer. The experimental complexes contain additional components. [CGRP receptor 6E3Y](https://www.rcsb.org/structure/6E3Y), [PAC1 receptor 6M1I](https://www.rcsb.org/structure/6M1I), [wwPDB CC0 policy](https://www.rcsb.org/pages/usage-policy).
