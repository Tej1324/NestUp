# NestUp 3D Assignment Viewer

This project is a browser-based 3D visualizer for the NestUp intern assignment.
It reads raw CSV furniture data and renders:

- the Level 0 wall
- the Level 1 cabinet placed relative to that wall
- the Level 2 planks placed relative to the cabinet

The goal is to turn raw manufacturing-style coordinates and dimensions into a visual scene that is easy to inspect and explain during a demo.

## What This Project Solves

The assignment PDF asks for a working 3D visual generated from raw row data.
This project does that by:

- parsing CSV or TSV input
- understanding object hierarchy by `Level`
- building 3D boxes from `LenX`, `LenY`, `LenZ`, `X`, `Y`, `Z`
- projecting the scene onto a browser canvas
- allowing the user to rotate, zoom, and inspect objects

This is useful in interior design and furniture planning because raw dimensions alone are hard to validate visually. A designer, carpenter, or manufacturing team can quickly check:

- where the cabinet sits on the wall
- how parts relate to each other
- whether coordinates and dimensions look reasonable
- whether bad rows or invalid values are present

## Features

- Self-contained browser app with no CDN dependency
- Sample data loaded by default
- CSV or TSV upload support
- Paste raw data directly into the text area
- Rotatable and zoomable 3D scene
- Wall focus, cabinet focus, and reset view controls
- Click any object to inspect the exact source row
- Validation notes for:
  - unsupported levels
  - invalid numeric values
  - zero or negative dimensions
  - negative positions
  - missing wall or cabinet context

## Project Structure

- [index.html](/Users/tejakodiyala/Desktop/NestUp/nestup-3d/index.html)
  Main UI layout for controls, canvas, summary, and inspection panel.

- [style.css](/Users/tejakodiyala/Desktop/NestUp/nestup-3d/style.css)
  Visual styling, responsive layout, panel design, and canvas presentation.

- [script.js](/Users/tejakodiyala/Desktop/NestUp/nestup-3d/script.js)
  Main application logic:
  - file input handling
  - CSV parsing
  - hierarchy resolution
  - box generation
  - projection math
  - canvas drawing
  - selection and interaction

- [data.csv](/Users/tejakodiyala/Desktop/NestUp/nestup-3d/data.csv)
  Original sample dataset used during development.

- [test-data/01-valid-basic.csv](/Users/tejakodiyala/Desktop/NestUp/nestup-3d/test-data/01-valid-basic.csv)
  Clean happy-path dataset.

- [test-data/02-negative-positions.csv](/Users/tejakodiyala/Desktop/NestUp/nestup-3d/test-data/02-negative-positions.csv)
  Tests negative coordinate handling.

- [test-data/03-zero-size-parts.csv](/Users/tejakodiyala/Desktop/NestUp/nestup-3d/test-data/03-zero-size-parts.csv)
  Tests skipping invalid zero-size parts.

- [test-data/04-unsupported-and-invalid.csv](/Users/tejakodiyala/Desktop/NestUp/nestup-3d/test-data/04-unsupported-and-invalid.csv)
  Tests unsupported levels and bad numeric values.

- [test-data/05-multiple-walls-and-cabinets.csv](/Users/tejakodiyala/Desktop/NestUp/nestup-3d/test-data/05-multiple-walls-and-cabinets.csv)
  Tests multi-parent assumptions.

- [main.py](/Users/tejakodiyala/Desktop/NestUp/nestup-3d/main.py)
  Early Python prototype using `matplotlib`.

- [requirements.txt](/Users/tejakodiyala/Desktop/NestUp/nestup-3d/requirements.txt)
  Python dependencies for the earlier prototype.

## Architecture

The code follows a simple pipeline:

`raw CSV -> parsed rows -> validated objects -> hierarchy placement -> box model -> 2D projection -> canvas render`

### 1. Input Layer

The app accepts data in two ways:

- file upload
- raw text pasted into the textarea

This is handled in [script.js](/Users/tejakodiyala/Desktop/NestUp/nestup-3d/script.js) through event listeners attached to the file input and render button.

### 2. Parsing Layer

`parseDelimitedText()` reads CSV or TSV text and converts each line into a row object keyed by column name.

### 3. Validation Layer

`buildScene()` and `parseRowDimensions()` validate:

- required columns
- numeric parsing
- unsupported levels
- non-positive dimensions

Rows with invalid geometry are skipped and reported in the validation notes.

### 4. Hierarchy Layer

This is the core logic of the assignment:

- Level 0 objects are rendered in world space
- Level 1 objects are placed relative to the first Level 0 wall
- Level 2 objects are placed relative to the first Level 1 cabinet

This matches the brief and makes the scene meaningful instead of rendering unrelated boxes.

### 5. Rendering Layer

Each row becomes a box with 8 vertices.
Those vertices are projected onto a 2D canvas using custom projection math.
Faces and wireframes are drawn so the user gets a readable 3D-like output in the browser.

### 6. Interaction Layer

The app supports:

- drag to rotate
- mouse wheel to zoom
- click to inspect an object
- quick camera buttons to focus on the wall or cabinet

## How To Run

### Option 1: Open Directly

Open [index.html](/Users/tejakodiyala/Desktop/NestUp/nestup-3d/index.html) in a modern browser.

### Option 2: Use a Local Server

From the `nestup-3d` folder:

```bash
python3 -m http.server 8123
```

Then open:

```text
http://127.0.0.1:8123
```

Using a local server is usually the cleanest way to test browser projects.

## How To Test

### Basic Check

1. Open the app.
2. Confirm sample data loads automatically.
3. Confirm the scene shows a wall, cabinet, and planks.
4. Drag to rotate and use the mouse wheel to zoom.
5. Click an object and verify the `Selected object` panel updates.

### Test With The Provided CSV Files

1. Upload [01-valid-basic.csv](/Users/tejakodiyala/Desktop/NestUp/nestup-3d/test-data/01-valid-basic.csv)
   Expect a clean scene with no major validation issues.

2. Upload [02-negative-positions.csv](/Users/tejakodiyala/Desktop/NestUp/nestup-3d/test-data/02-negative-positions.csv)
   Expect the scene to render, with validation notes mentioning negative positions.

3. Upload [03-zero-size-parts.csv](/Users/tejakodiyala/Desktop/NestUp/nestup-3d/test-data/03-zero-size-parts.csv)
   Expect zero-size planks to be skipped and reported.

4. Upload [04-unsupported-and-invalid.csv](/Users/tejakodiyala/Desktop/NestUp/nestup-3d/test-data/04-unsupported-and-invalid.csv)
   Expect bad rows to be skipped and warnings shown.

5. Upload [05-multiple-walls-and-cabinets.csv](/Users/tejakodiyala/Desktop/NestUp/nestup-3d/test-data/05-multiple-walls-and-cabinets.csv)
   Expect the renderer to use the first wall and first cabinet as the primary parents, with notes explaining that assumption.

## Demo Notes

If you need to explain the project live, a simple way is:

1. Each CSV row represents one object in the scene.
2. `Level` tells me whether the row is a wall, cabinet, or plank.
3. I parse dimensions and coordinates from millimeter values.
4. I place Level 1 relative to the wall and Level 2 relative to the cabinet.
5. I convert each row into a box and draw it on the canvas.
6. I validate edge cases like zero sizes, bad levels, and invalid numbers.
7. I can click any object and show exactly which row it came from.

## Assumptions

- `LenX`, `LenY`, `LenZ`, `X`, `Y`, and `Z` are in millimeters.
- Values may include the `mm` suffix.
- Level 1 positions are interpreted relative to the first Level 0 wall.
- Level 2 positions are interpreted relative to the first Level 1 cabinet.
- Negative positions are allowed and still rendered, but are flagged.
- Zero or negative dimensions are treated as invalid for rendering and are skipped.

## Known Limitations

- If multiple walls or cabinets exist, the viewer currently uses the first matching parent for hierarchy placement.
- This renderer is a lightweight custom canvas renderer, not a full CAD engine.
- The goal is assignment clarity and explainability, not production-grade geometry modeling.

## Submission Value

This project demonstrates:

- data parsing from raw input
- hierarchy handling
- coordinate reasoning
- validation and edge-case thinking
- clear visual output
- explainable, readable code

That aligns well with what the NestUp assignment says they want to evaluate.
