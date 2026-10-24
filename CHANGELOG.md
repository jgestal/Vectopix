# Changelog

All notable changes to Vectopix. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [1.4.0] - 2026-10-25

### Added
- **Exact pixel grid** option (on in the *Exact pixel art* preset): pixel art is traced along its own grid, with straight runs, square corners and no curves.
- Settings are part of the undo history: undo brings back a result together with the settings that produced it.
- End-to-end browser tests (Playwright) in CI: samples, file picker, drag and drop, unsupported formats, node editing, undo, transparent background, every export format and language switching.

### Changed
- **Changing a setting no longer discards your edits.** The new trace is added to the history, so your edited version is one undo back (a notice says so).
- *Transparent background* removes only the background around the subject; areas of the same colour inside it (the white of a logo, a white star on a badge) are kept. The subject's outline is the same as in an opaque trace.
- Smoothing levels now differ: *maximum* also merges near-identical regions before tracing (about 30 % fewer nodes on photos).
- The side-by-side label and the status bar count the same thing: every shape drawn, circles and rectangles included.

### Fixed
- *Transparent background* left a white or grey fringe around the subject and could keep part of the background.
- Hairline cracks between neighbouring shapes, where the background showed through at some zoom levels. A shape whose hole is filled by other shapes is now drawn whole, with those shapes on top; pixel-art colours overlap by half a pixel under their neighbours.
- JPEG images were traced with many extra colours (compression splits each flat colour into near-identical shades): a 3-colour badge came out with 11 colours and over 1,600 nodes, and now comes out with 3 colours and 40.
- Small images (around 64 px) were distorted by the geometry clean-up; an outline is now refitted only when the result stays on the traced shape.
- Pixel art had small notches at block corners.
- A thin frame of another colour could appear along the image border.
- Undo/redo shortcuts did nothing right after clicking a checkbox or slider.

## [1.3.0] - 2026-10-24

### Added
- Automatic colour detection: the image's real colours are found and anti-aliasing blends are ignored.
- Geometry clean-up: straight edges become single lines, corners are sharp and round parts become true arcs.

### Changed
- Logos come out with far fewer nodes (the sample logo: 321 → 42 nodes, all 9 colours, 99.1 % fidelity).
- DXF, EPS and PDF exports are built from the cleaned-up SVG.
- The node count shows the anchors you can edit, not control points.

## [1.2.0] - 2026-10-24

### Changed
- New clean, legible interface (IBM Plex Sans, light and dark modes) replacing the retro look.
- Settings panel with the common choices visible and engine tuning under *Advanced*.

## [1.1.0] - 2026-10-24

### Added
- Samples can be dragged onto the drop zone; images dragged from web pages are fetched when the site allows it.
- More input formats through vecline's decoders (TGA, PNM, BMP, ICO).

### Changed
- Retro interface inspired by classic Paint (replaced in 1.2.0).

### Fixed
- Dropped files were silently ignored when they could not be loaded; errors are now shown everywhere.

## [1.0.0] - 2026-10-24

### Added
- First release as Vectopix: tracing to SVG, DXF, EPS and PDF entirely on your machine, with a Bézier node editor.
- Eight languages: English, Spanish, German, French, Italian, Portuguese, Chinese and Japanese.
- Desktop apps for macOS, Windows and Linux, published on GitHub releases, and the web version on GitHub Pages.

[1.4.0]: https://github.com/jgestal/Vectopix/compare/v1.3.0...v1.4.0
[1.3.0]: https://github.com/jgestal/Vectopix/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/jgestal/Vectopix/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/jgestal/Vectopix/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/jgestal/Vectopix/releases/tag/v1.0.0
