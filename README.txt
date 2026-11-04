CONTINUUM SOMATIC · GITHUB-SAFE SPLIT BUILD
==========================================
This is the Somatic Audio Signal Flow Repair build, separated into the same
synth, UI, and DSP modules and the ORIGINAL compressed sound assets.
The source HTML and its 627 embedded binary resources were split without
replacing or regenerating preset data, wavetables, samples, or DSP.

HOW TO PUT ON GITHUB PAGES
1. EXTRACT the ZIP into a folder.
2. Upload the CONTENTS of that folder into your GitHub repository:
   index.html, presets.js, fallback.js, engine.js, pages.js, shell.js,
   voice.wasm.gz and the entire assets/ folder, maintaining the paths.
3. Publish via GitHub Pages, with index.html at the website root.
   Each file is much smaller than GitHub's 25 MB browser-upload limit.
   Do not upload the ZIP itself as the website; upload extracted files.

HOW TO RUN LOCALLY
- On Windows double-click START_LOCAL.bat (requires Python 3).
- Or open a terminal in this folder:
      python -m http.server 8000 --bind 127.0.0.1
  Then visit http://127.0.0.1:8000
- Do not double-click index.html as a file:// URL. External sound resources
  use fetch(), which needs a local HTTP server (or GitHub Pages).

INTERNAL FILES
index.html   - original UI shell and CSS
presets.js   - original synth state and factory patch definitions
fallback.js  - existing AudioWorklet compatibility renderer
engine.js    - synthesis engine, asset loader, routing, and FX
pages.js     - original page layout, controls and visualizations
shell.js     - original global transport/navigation/keyboard/MIDI
voice.wasm.gz - original gzip-compressed voice synthesis binary
assets/      - original gzip-compressed waveforms, samples, metadata

NOTE: This is a packaging conversion, not a new DSP repair. It carries forward
exactly the audio repair previously provided. Browser playback still needs
live testing on your target browser and hosting setup.
