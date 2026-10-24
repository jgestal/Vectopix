---
name: vector-graphics-engineering
description: Comprehensive engineering guide for building browser-based raster-to-vector (SVG) conversion applications inspired by Vector Magic and Vectorizer.ai.
---

# Vector Graphics Engineering Guide

This skill details the architectural principles, algorithms, performance strategies, and UI/UX patterns required to build a browser-based raster-to-vector graphics application matching or exceeding the capabilities of **Vector Magic**.

---

## 1. Algorithmic Pipeline: How Vector Magic & Modern Vectorizers Work

Converting a bitmap (discrete grid of pixels) into clean, scalable vector curves (Bézier splines) requires a multi-stage mathematical pipeline:

```
[Input Bitmap] 
      │
      ▼
1. Preprocessing & Denoising (Bilateral / Kuwahara / Despeckle)
      │
      ▼
2. Color Space Transformation & Quantization (Oklab / CIELAB K-Means Clustering)
      │
      ▼
3. Segmentation & Connected Components (Pixel Neighborhood Topology)
      │
      ▼
4. Boundary Detection & Sub-Pixel Anti-Aliasing Reconstruction
      │
      ▼
5. Polygon Tracing & Curve Fitting (Douglas-Peucker + Cubic Bézier Least-Squares)
      │
      ▼
6. Topological Stitching & Shared Edge Alignment (Preventing gaps & overlaps)
      │
      ▼
7. SVG Optimization & Multi-Format Serialization (SVG, DXF, EPS, PDF)
```

### Key Breakthrough: Sub-Pixel Anti-Aliasing Reconstruction
Standard tracers (e.g. basic Potrace or naive polygon tracing) treat pixels as binary blocks, resulting in jagged "staircase" artifacts or bloated "node soup".
* **The Vector Magic Advantage**: Vector Magic evaluates the opacity and color gradient ramp along anti-aliased boundaries. It calculates the **fractional pixel coverage** to estimate the virtual sub-pixel position of the original mathematical curve.
* **Implementation in Browser**: Using `vecline` with sub-pixel curve fitting and Oklab color perceptual metrics reconstructs smooth cubic Bézier curves (`C` and `S` SVG path commands) directly from anti-aliased edges.

---

## 2. Centerline Tracing (Single-Stroke Skeletonization)

In addition to closed outline polygons (fill mode), technical workflows (laser cutting, CNC routing, vinyl pen plotters, signatures, engravings, CAD blueprints) require **Centerline Tracing**:
* **Mechanism**: Binarizes the raster image and applies morphological thinning (Zhang-Suen thinning / medial axis skeletonization) to reduce thick strokes down to 1-pixel-wide central fibers.
* **Polylines to Paths**: Traces continuous polyline chains (`centerlinePolylines`), then fits smooth stroke curves with configurable width, linecap, and linejoin.
* **DXF & CAD Export**: Directly exports true `POLYLINE` entities in AutoCAD DXF format for CNC machinery with inverted Y Cartesian coordinate conversion.

---

## 3. Interactive Bézier Node Editor Architecture

A professional vectorizer must allow manual post-processing and node adjustments:
1. **Tokenization & Normalization**:
   - Parses arbitrary SVG path `d` strings handling compressed decimals (`.7.1` or `10-20`).
   - Normalizes all relative commands (`m`, `l`, `h`, `v`, `c`, `s`, `q`) to absolute coordinates (`M`, `L`, `C`, `Z`).
2. **Anchor & Control Handle Decoupling**:
   - Anchors define the curve endpoints.
   - For cubic Bézier segments (`C`), control handles `(cp1x, cp1y)` and `(cp2x, cp2y)` define curve tension and tangent direction.
3. **Interactive Dragging & Live DOM Serialization**:
   - Coordinate transformations between viewport mouse screen space and artboard matrix: `artboard = (screen - pan) / zoom`.
   - Modifying handles updates the underlying path segments in real-time.
   - Re-serializes to valid SVG markup (`serializeParsedDoc`) without re-running the heavy rasterization pipeline.
   - Exports (SVG, React TSX, DXF) immediately reflect user node edits.

---

## 4. Core Libraries & Engine Selection for Web Browsers

| Tool / Library | Role & Tech Stack | Best Used For |
|---|---|---|
| **Vecline** (`vecline`) | Zero-dependency TypeScript/WASM engine | Logos, flat artwork, bit-exact reproduction (`SSIM 1.0000`), Centerline skeletonization, DXF/EPS/SVG export, SSIM/PSNR verification. |
| **VTracer** (`visioncortex/vtracer`) | Rust compiled to WebAssembly (`wasm`) | High-fidelity photographs, scans, complex gradient illustrations with hierarchical clustering. |
| **Potrace (WASM/JS)** | C compiled to WASM / JS port | Ultra-fast monochrome vectorization (signatures, black-and-white stamps, silhouettes). |
| **ImageTracerJS** | Pure JavaScript | Fast multi-palette preview tracing, client-side fallback. |

---

## 5. High-Performance Browser Architecture

1. **Dedicated Web Workers**:
   - Never run vectorization or heavy image decoding on the main UI thread.
   - Dispatch `ImageData` or `ArrayBuffer` to a Web Worker via `postMessage` using Transferable Objects (`[buffer]`) to achieve zero-copy memory transfers.
   - Stream progress updates (`0%` to `100%`) back to the UI thread for user feedback.

2. **OffscreenCanvas Preprocessing**:
   - Execute bilateral filtering, Kuwahara smoothing, and color downsampling inside worker threads using `OffscreenCanvas`.

3. **Viewport & Rendering**:
   - Render the resulting SVG inside a high-performance Pan & Zoom container (using CSS transforms `translate3d` and `scale`).
   - Implement an interactive **Before / After Split Curtain Slider** comparing the original pixel raster against the rendered SVG paths in real-time.
   - Provide visual overlays: Node inspection (anchor points and Bézier control handles) and wireframe mode (`fill: none; stroke: #00f`).

4. **Metrics & Quality Verification**:
   - Compute SSIM (Structural Similarity Index Measure) and PSNR (Peak Signal-to-Noise Ratio) to provide objective proof of conversion accuracy.

---

## 6. Advanced Curve Manipulation & Subdivision Algorithms

1. **De Casteljau's Midpoint Subdivision ($t = 0.5$)**:
   - When inserting an anchor into an existing cubic Bézier curve segment $P_0, P_1, P_2, P_3$:
     $$Q_0 = \frac{P_0 + P_1}{2}, \quad Q_1 = \frac{P_1 + P_2}{2}, \quad Q_2 = \frac{P_2 + P_3}{2}$$
     $$R_0 = \frac{Q_0 + Q_1}{2}, \quad R_1 = \frac{Q_1 + Q_2}{2}, \quad M = \frac{R_0 + R_1}{2}$$
   - The first sub-curve becomes $(P_0, Q_0, R_0, M)$ and the second $(M, R_1, Q_2, P_3)$.
   - Mathematically preserves 100% of the original curve's shape while introducing an interactive editing anchor at the exact curve midpoint.

2. **Bilateral Noise Reduction**:
   - Reduces high-frequency JPEG compression artifacts and sensor noise before color quantization.
   - Preserves high-contrast color step edges to prevent boundary erosion.

3. **Compliant Multi-Format CAD & Print Serialization**:
   - **DXF**: Emits AutoCAD DXF R12 `POLYLINE` / `VERTEX` entities with Y-inversion for CNC routers and laser cutters.
   - **PDF**: Emits native Adobe PDF 1.4 vector streams (`m`, `l`, `c`, `S`, `f`) directly in client-side memory without third-party server binaries.
   - **SVG Minification**: Normalizes numbers to 2 decimal places, strips redundant namespace prologs, and optimizes path commands.
