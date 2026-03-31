const SAMPLE_DATA = `Entity Name,Level,Material,LenX,LenY,LenZ,X,Y,Z,plank_id
MBR Wall 4,0,,540mm,5387mm,2884mm,0mm,0mm,0mm,
Shoerack,1,,1000mm,276mm,700mm,540mm,0mm,0mm,
back plank 1,2,inner,1362mm,10mm,390mm,0mm,440mm,110mm,1
vertical 2,2,inner,18mm,80mm,354mm,452mm,18mm,128mm,2
top plank,2,inner,1334mm,422mm,18mm,18mm,18mm,482mm,3
left plank,2,inner,18mm,422mm,500mm,0mm,18mm,0mm,4
right plank,2,217 DM,18mm,434mm,500mm,1352mm,18mm,0mm,5
bottom plank,2,inner,1334mm,422mm,18mm,18mm,18mm,110mm,6
skirting,2,217 DM,1380mm,18mm,110mm,0mm,18mm,0mm,7
Component#137,2,217 DM,1370mm,450mm,18mm,0mm,0mm,500mm,8`;

const REQUIRED_COLUMNS = ["Entity Name", "Level", "LenX", "LenY", "LenZ", "X", "Y", "Z"];

const els = {
  canvas: document.getElementById("sceneCanvas"),
  canvasWrap: document.getElementById("canvasWrap"),
  dataInput: document.getElementById("dataInput"),
  fileInput: document.getElementById("fileInput"),
  renderButton: document.getElementById("renderButton"),
  sampleButton: document.getElementById("sampleButton"),
  resetViewButton: document.getElementById("resetViewButton"),
  focusCabinetButton: document.getElementById("focusCabinetButton"),
  focusWallButton: document.getElementById("focusWallButton"),
  statusBadge: document.getElementById("statusBadge"),
  summaryCards: document.getElementById("summaryCards"),
  notesList: document.getElementById("notesList"),
  selectionCard: document.getElementById("selectionCard")
};

const ctx = els.canvas.getContext("2d");

const state = {
  yaw: -0.75,
  pitch: 0.45,
  zoom: 0.14,
  panX: 0,
  panY: 0,
  dragStartX: 0,
  dragStartY: 0,
  pointerDownX: 0,
  pointerDownY: 0,
  didDrag: false,
  isDragging: false,
  boxes: [],
  faces: [],
  notes: [],
  hoveredBoxId: null,
  selectedBoxId: null,
  boundingCenter: { x: 0, y: 0, z: 0 },
  boundingSize: 1,
  viewCenter: { x: 0, y: 0, z: 0 },
  viewSize: 1
};

function init() {
  els.dataInput.value = SAMPLE_DATA;
  bindEvents();
  resizeCanvas();
  renderFromText(SAMPLE_DATA);
}

function bindEvents() {
  window.addEventListener("resize", () => {
    resizeCanvas();
    drawScene();
  });

  els.renderButton.addEventListener("click", () => renderFromText(els.dataInput.value));
  els.sampleButton.addEventListener("click", () => {
    els.dataInput.value = SAMPLE_DATA;
    renderFromText(SAMPLE_DATA);
  });
  els.resetViewButton.addEventListener("click", () => {
    resetView();
    drawScene();
  });
  els.focusCabinetButton.addEventListener("click", () => {
    setViewForLevel(1);
    drawScene();
  });
  els.focusWallButton.addEventListener("click", () => {
    setViewForLevel(0);
    drawScene();
  });

  els.fileInput.addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (!file) {
      return;
    }

    const text = await file.text();
    els.dataInput.value = text;
    renderFromText(text);
  });

  els.canvas.addEventListener("pointerdown", handlePointerDown);
  window.addEventListener("pointermove", handlePointerMove);
  window.addEventListener("pointerup", handlePointerUp);
  els.canvas.addEventListener("wheel", handleWheel, { passive: false });
  els.canvas.addEventListener("click", handleClick);
}

function resizeCanvas() {
  const { width, height } = els.canvasWrap.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  els.canvas.width = Math.max(1, Math.floor(width * ratio));
  els.canvas.height = Math.max(1, Math.floor(height * ratio));
  els.canvas.style.width = `${width}px`;
  els.canvas.style.height = `${height}px`;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function renderFromText(rawText) {
  try {
    const parsed = parseDelimitedText(rawText);
    const sceneData = buildScene(parsed.rows, parsed.headers);
    state.boxes = sceneData.boxes;
    state.notes = sceneData.notes;
    state.boundingCenter = sceneData.boundingCenter;
    state.boundingSize = sceneData.boundingSize;
    state.selectedBoxId = state.boxes[0] ? state.boxes[0].id : null;
    state.hoveredBoxId = null;
    resetView();
    updateStatus(`Rendered ${state.boxes.length} objects`, false);
    renderSummary(sceneData.summary);
    renderNotes(sceneData.notes);
    renderSelection();
    drawScene();
  } catch (error) {
    state.boxes = [];
    state.faces = [];
    state.notes = [error.message];
    state.selectedBoxId = null;
    renderSummary({
      total: 0,
      walls: 0,
      cabinets: 0,
      planks: 0,
      highlighted: 0
    });
    renderNotes(state.notes);
    renderSelection();
    updateStatus(error.message, true);
    drawEmptyState(error.message);
  }
}

function parseDelimitedText(rawText) {
  const normalized = rawText.replace(/\r\n/g, "\n").trim();
  if (!normalized) {
    throw new Error("Paste CSV or TSV data before rendering.");
  }

  const lines = normalized
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    throw new Error("The data needs a header row and at least one object row.");
  }

  const delimiter = lines[0].includes("\t") ? "\t" : ",";
  const headers = splitDelimitedLine(lines[0], delimiter);
  const rows = lines.slice(1).map((line, index) => {
    const cells = splitDelimitedLine(line, delimiter);
    const row = {};

    headers.forEach((header, cellIndex) => {
      row[header] = (cells[cellIndex] || "").trim();
    });

    row.__rowNumber = index + 2;
    row.__raw = line;
    return row;
  });

  return { headers, rows };
}

function splitDelimitedLine(line, delimiter) {
  const cells = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === delimiter && !inQuotes) {
      cells.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current);
  return cells;
}

function buildScene(rows, headers) {
  const missingColumns = REQUIRED_COLUMNS.filter((column) => !headers.includes(column));
  if (missingColumns.length > 0) {
    throw new Error(`Missing required column(s): ${missingColumns.join(", ")}`);
  }

  const notes = [];
  const boxes = [];
  const summary = {
    total: 0,
    walls: 0,
    cabinets: 0,
    planks: 0,
    highlighted: 0
  };

  const walls = [];
  const cabinets = [];
  const planks = [];

  rows.forEach((row) => {
    const level = Number.parseInt(row.Level, 10);
    if (!Number.isFinite(level)) {
      notes.push(`Row ${row.__rowNumber}: skipped because Level is not a valid number.`);
      return;
    }

    if (level === 0) {
      walls.push(row);
      return;
    }

    if (level === 1) {
      cabinets.push(row);
      return;
    }

    if (level === 2) {
      planks.push(row);
      return;
    }

    notes.push(`Row ${row.__rowNumber}: Level ${level} is not supported in this assignment.`);
  });

  const wallOrigins = [];
  walls.forEach((row, wallIndex) => {
    const parsed = parseRowDimensions(row, notes);
    if (!parsed) {
      return;
    }

    const box = createSceneBox(row, parsed, {
      level: 0,
      origin: { x: parsed.position.x, y: parsed.position.y, z: parsed.position.z },
      color: "#74889b",
      accentColor: "#97a9b8"
    });

    box.parentName = "World";
    boxes.push(box);
    wallOrigins.push({
      name: row["Entity Name"] || `Wall ${wallIndex + 1}`,
      origin: box.origin
    });
    summary.total += 1;
    summary.walls += 1;
  });

  const primaryWallOrigin = wallOrigins[0] ? wallOrigins[0].origin : { x: 0, y: 0, z: 0 };
  if (walls.length === 0) {
    notes.push("No Level 0 wall was found, so the cabinet is rendered from the global origin.");
  }
  if (walls.length > 1) {
    notes.push("Multiple Level 0 walls were found. Level 1 cabinets are positioned relative to the first wall.");
  }

  const cabinetOrigins = [];
  cabinets.forEach((row, cabinetIndex) => {
    const parsed = parseRowDimensions(row, notes);
    if (!parsed) {
      return;
    }

    const origin = {
      x: primaryWallOrigin.x + parsed.position.x,
      y: primaryWallOrigin.y + parsed.position.y,
      z: primaryWallOrigin.z + parsed.position.z
    };

    const box = createSceneBox(row, parsed, {
      level: 1,
      origin,
      color: "#55b2ff",
      accentColor: "#8bd3ff"
    });

    box.parentName = wallOrigins[0] ? wallOrigins[0].name : "World";
    boxes.push(box);
    cabinetOrigins.push({
      name: row["Entity Name"] || `Cabinet ${cabinetIndex + 1}`,
      origin
    });
    summary.total += 1;
    summary.cabinets += 1;
  });

  const primaryCabinetOrigin = cabinetOrigins[0] ? cabinetOrigins[0].origin : primaryWallOrigin;
  if (cabinets.length === 0) {
    notes.push("No Level 1 cabinet was found, so Level 2 planks are rendered from the wall origin.");
  }
  if (cabinets.length > 1) {
    notes.push("Multiple Level 1 cabinets were found. Level 2 planks are positioned relative to the first cabinet.");
  }

  planks.forEach((row) => {
    const parsed = parseRowDimensions(row, notes);
    if (!parsed) {
      return;
    }

    const origin = {
      x: primaryCabinetOrigin.x + parsed.position.x,
      y: primaryCabinetOrigin.y + parsed.position.y,
      z: primaryCabinetOrigin.z + parsed.position.z
    };

    const highlighted = String(row.Material || "").toLowerCase().includes("217");
    const box = createSceneBox(row, parsed, {
      level: 2,
      origin,
      color: highlighted ? "#ffb562" : "#8fd27d",
      accentColor: highlighted ? "#ffd3a0" : "#c4e8b7"
    });

    box.parentName = cabinetOrigins[0] ? cabinetOrigins[0].name : (wallOrigins[0] ? wallOrigins[0].name : "World");
    boxes.push(box);
    summary.total += 1;
    summary.planks += 1;
    if (highlighted) {
      summary.highlighted += 1;
    }
  });

  if (boxes.length === 0) {
    throw new Error("No valid Level 0, 1, or 2 rows could be rendered.");
  }

  const bounds = computeBounds(boxes);
  return {
    boxes,
    notes,
    summary,
    boundingCenter: bounds.center,
    boundingSize: bounds.size
  };
}

function parseRowDimensions(row, notes) {
  const lengthX = parseMillimeters(row.LenX);
  const lengthY = parseMillimeters(row.LenY);
  const lengthZ = parseMillimeters(row.LenZ);
  const positionX = parseMillimeters(row.X);
  const positionY = parseMillimeters(row.Y);
  const positionZ = parseMillimeters(row.Z);
  const rowLabel = row["Entity Name"] || `Row ${row.__rowNumber}`;

  if ([lengthX, lengthY, lengthZ, positionX, positionY, positionZ].some((value) => Number.isNaN(value))) {
    notes.push(`Row ${row.__rowNumber} (${rowLabel}): skipped because one or more numeric values could not be parsed.`);
    return null;
  }

  if (lengthX <= 0 || lengthY <= 0 || lengthZ <= 0) {
    notes.push(`Row ${row.__rowNumber} (${rowLabel}): skipped because at least one size is zero or negative.`);
    return null;
  }

  if (positionX < 0 || positionY < 0 || positionZ < 0) {
    notes.push(`Row ${row.__rowNumber} (${rowLabel}): uses a negative position and was still rendered.`);
  }

  return {
    size: { x: lengthX, y: lengthY, z: lengthZ },
    position: { x: positionX, y: positionY, z: positionZ }
  };
}

function parseMillimeters(value) {
  if (value === undefined || value === null || value === "") {
    return 0;
  }

  const cleaned = String(value).replace(/mm/gi, "").replace(/,/g, "").trim();
  return Number.parseFloat(cleaned);
}

function createSceneBox(row, parsed, config) {
  const box = {
    id: `box-${row.__rowNumber}`,
    rowNumber: row.__rowNumber,
    row,
    level: config.level,
    name: row["Entity Name"] || `Row ${row.__rowNumber}`,
    material: row.Material || "n/a",
    plankId: row.plank_id || "n/a",
    size: parsed.size,
    localPosition: parsed.position,
    origin: config.origin,
    color: config.color,
    accentColor: config.accentColor
  };

  box.center = {
    x: box.origin.x + box.size.x / 2,
    y: box.origin.y + box.size.y / 2,
    z: box.origin.z + box.size.z / 2
  };

  box.vertices = buildVertices(box.origin, box.size);
  return box;
}

function buildVertices(origin, size) {
  const x0 = origin.x;
  const y0 = origin.y;
  const z0 = origin.z;
  const x1 = origin.x + size.x;
  const y1 = origin.y + size.y;
  const z1 = origin.z + size.z;

  return [
    { x: x0, y: y0, z: z0 },
    { x: x1, y: y0, z: z0 },
    { x: x1, y: y1, z: z0 },
    { x: x0, y: y1, z: z0 },
    { x: x0, y: y0, z: z1 },
    { x: x1, y: y0, z: z1 },
    { x: x1, y: y1, z: z1 },
    { x: x0, y: y1, z: z1 }
  ];
}

function computeBounds(boxes) {
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;

  boxes.forEach((box) => {
    box.vertices.forEach((vertex) => {
      minX = Math.min(minX, vertex.x);
      minY = Math.min(minY, vertex.y);
      minZ = Math.min(minZ, vertex.z);
      maxX = Math.max(maxX, vertex.x);
      maxY = Math.max(maxY, vertex.y);
      maxZ = Math.max(maxZ, vertex.z);
    });
  });

  return {
    center: {
      x: (minX + maxX) / 2,
      y: (minY + maxY) / 2,
      z: (minZ + maxZ) / 2
    },
    size: Math.max(maxX - minX, maxY - minY, maxZ - minZ, 1)
  };
}

function resetView() {
  state.yaw = -0.72;
  state.pitch = 0.32;
  state.viewCenter = state.boundingCenter;
  state.viewSize = state.boundingSize;
  state.zoom = Math.max(0.045, 520 / state.viewSize);
  state.panX = 0;
  state.panY = 0;
}

function setViewForLevel(level) {
  const relevantBoxes = level === 0
    ? state.boxes.filter((box) => box.level === 0 || box.level === 1)
    : state.boxes.filter((box) => box.level === 1 || box.level === 2);

  if (relevantBoxes.length === 0) {
    resetView();
    return;
  }

  const bounds = computeBounds(relevantBoxes);
  state.viewCenter = bounds.center;
  state.viewSize = bounds.size;
  state.yaw = level === 0 ? -0.92 : -0.6;
  state.pitch = level === 0 ? 0.18 : 0.52;
  state.zoom = Math.max(0.05, 520 / state.viewSize);
  state.panX = level === 1 ? 40 : 0;
  state.panY = 0;
}

function drawScene() {
  const width = els.canvas.clientWidth;
  const height = els.canvas.clientHeight;
  ctx.clearRect(0, 0, width, height);

  drawBackground(width, height);
  drawAxes(width, height);

  const allFaces = [];
  state.boxes.forEach((box) => {
    const projectedVertices = box.vertices.map((vertex) => projectPoint(vertex, width, height));
    const faces = buildFacesForBox(box, projectedVertices);
    allFaces.push(...faces);
  });

  allFaces.sort((a, b) => a.depth - b.depth);
  state.faces = allFaces;

  allFaces.forEach((face) => {
    ctx.beginPath();
    face.points.forEach((point, index) => {
      if (index === 0) {
        ctx.moveTo(point.x, point.y);
      } else {
        ctx.lineTo(point.x, point.y);
      }
    });
    ctx.closePath();
    ctx.globalAlpha = face.opacity;
    ctx.fillStyle = face.fill;
    ctx.strokeStyle = face.stroke;
    ctx.lineWidth = face.lineWidth;
    ctx.fill();
    ctx.stroke();
  });
  ctx.globalAlpha = 1;

  drawWireframes(width, height);
  drawBoxLabels(width, height);
}

function drawBackground(width, height) {
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, "rgba(255,255,255,0.04)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "rgba(139, 211, 255, 0.06)";
  ctx.lineWidth = 1;
  const spacing = Math.max(28, width / 22);
  for (let x = 0; x < width; x += spacing) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
}

function drawAxes(width, height) {
  const axisLength = state.boundingSize * 0.25;
  const axes = [
    { to: { x: state.boundingCenter.x + axisLength, y: state.boundingCenter.y, z: state.boundingCenter.z }, color: "#ff9e9e", label: "X" },
    { to: { x: state.boundingCenter.x, y: state.boundingCenter.y + axisLength, z: state.boundingCenter.z }, color: "#9ed0ff", label: "Y" },
    { to: { x: state.boundingCenter.x, y: state.boundingCenter.y, z: state.boundingCenter.z + axisLength }, color: "#9ef2c7", label: "Z" }
  ];

  const origin = projectPoint(state.boundingCenter, width, height);
  axes.forEach((axis) => {
    const projected = projectPoint(axis.to, width, height);
    ctx.beginPath();
    ctx.moveTo(origin.x, origin.y);
    ctx.lineTo(projected.x, projected.y);
    ctx.strokeStyle = axis.color;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = axis.color;
    ctx.font = "12px Avenir Next";
    ctx.fillText(axis.label, projected.x + 6, projected.y - 6);
  });
}

function buildFacesForBox(box, projectedVertices) {
  const faces = [
    makeFace(box, projectedVertices, [0, 1, 2, 3], shadeHex(box.color, -18)),
    makeFace(box, projectedVertices, [0, 1, 5, 4], shadeHex(box.color, -6)),
    makeFace(box, projectedVertices, [1, 2, 6, 5], shadeHex(box.color, 8)),
    makeFace(box, projectedVertices, [2, 3, 7, 6], shadeHex(box.color, 2)),
    makeFace(box, projectedVertices, [3, 0, 4, 7], shadeHex(box.color, -12)),
    makeFace(box, projectedVertices, [4, 5, 6, 7], shadeHex(box.color, 18))
  ];

  return faces;
}

function drawWireframes(width, height) {
  ctx.lineWidth = 1.1;

  state.boxes.forEach((box) => {
    const points = box.vertices.map((vertex) => projectPoint(vertex, width, height));
    const selected = state.selectedBoxId === box.id;
    ctx.strokeStyle = selected ? "rgba(255,255,255,0.95)" : "rgba(207, 228, 247, 0.55)";

    const edges = [
      [0, 1], [1, 2], [2, 3], [3, 0],
      [4, 5], [5, 6], [6, 7], [7, 4],
      [0, 4], [1, 5], [2, 6], [3, 7]
    ];

    edges.forEach(([from, to]) => {
      ctx.beginPath();
      ctx.moveTo(points[from].x, points[from].y);
      ctx.lineTo(points[to].x, points[to].y);
      ctx.stroke();
    });
  });
}

function makeFace(box, projectedVertices, indices, fill) {
  const points = indices.map((index) => projectedVertices[index]);
  const normalZ = computeProjectedNormal(points);
  const selected = state.selectedBoxId === box.id;
  const hovered = state.hoveredBoxId === box.id;
  return {
    boxId: box.id,
    points,
    depth: indices.reduce((sum, index) => sum + projectedVertices[index].depth, 0) / indices.length,
    fill: selected ? shadeHex(box.accentColor, 8) : (hovered ? shadeHex(fill, 12) : fill),
    stroke: selected ? "rgba(255,255,255,0.95)" : "rgba(3, 10, 16, 0.55)",
    lineWidth: selected ? 2 : 1,
    opacity: box.level === 0 ? 0.28 : (box.level === 1 ? 0.84 : 0.92),
    normalZ
  };
}

function computeProjectedNormal(points) {
  const ax = points[1].x - points[0].x;
  const ay = points[1].y - points[0].y;
  const bx = points[2].x - points[0].x;
  const by = points[2].y - points[0].y;
  return ax * by - ay * bx;
}

function projectPoint(point, width, height) {
  const centeredX = point.x - state.viewCenter.x;
  const centeredY = point.y - state.viewCenter.y;
  const centeredZ = point.z - state.viewCenter.z;

  const cosYaw = Math.cos(state.yaw);
  const sinYaw = Math.sin(state.yaw);
  const cosPitch = Math.cos(state.pitch);
  const sinPitch = Math.sin(state.pitch);

  const x1 = centeredX * cosYaw - centeredY * sinYaw;
  const y1 = centeredX * sinYaw + centeredY * cosYaw;
  const z1 = centeredZ;

  const y2 = y1 * cosPitch - z1 * sinPitch;
  const z2 = y1 * sinPitch + z1 * cosPitch;

  return {
    x: width / 2 + state.panX + x1 * state.zoom,
    y: height / 2 + state.panY - y2 * state.zoom,
    depth: z2
  };
}

function drawBoxLabels(width, height) {
  ctx.font = "12px Avenir Next";
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";

  state.boxes.forEach((box) => {
    if (box.level > 1) {
      return;
    }

    const point = projectPoint(box.center, width, height);
    ctx.fillStyle = "rgba(237, 246, 255, 0.9)";
    ctx.fillText(box.name, point.x, point.y - 8);
  });
}

function drawEmptyState(message) {
  const width = els.canvas.clientWidth;
  const height = els.canvas.clientHeight;
  ctx.clearRect(0, 0, width, height);
  drawBackground(width, height);
  ctx.fillStyle = "rgba(237, 246, 255, 0.9)";
  ctx.font = "18px Avenir Next";
  ctx.textAlign = "center";
  ctx.fillText(message, width / 2, height / 2);
}

function renderSummary(summary) {
  els.summaryCards.innerHTML = `
    <article class="summary-card">
      <strong>${summary.total}</strong>
      <p>Renderable objects</p>
    </article>
    <article class="summary-card">
      <strong>${summary.walls}</strong>
      <p>Walls (Level 0)</p>
    </article>
    <article class="summary-card">
      <strong>${summary.cabinets}</strong>
      <p>Cabinets (Level 1)</p>
    </article>
    <article class="summary-card">
      <strong>${summary.planks}</strong>
      <p>Planks (Level 2)</p>
    </article>
  `;
}

function renderNotes(notes) {
  const safeNotes = notes.length > 0 ? notes : ["No validation issues detected in the current data."];
  els.notesList.innerHTML = safeNotes.map((note) => `<li>${escapeHtml(note)}</li>`).join("");
}

function renderSelection() {
  const selected = state.boxes.find((box) => box.id === state.selectedBoxId);
  if (!selected) {
    els.selectionCard.innerHTML = "<p>Select an object in the canvas to inspect its source row.</p>";
    return;
  }

  els.selectionCard.innerHTML = `
    <dl>
      <dt>Entity</dt>
      <dd>${escapeHtml(selected.name)}</dd>
      <dt>Row</dt>
      <dd>${selected.rowNumber}</dd>
      <dt>Level</dt>
      <dd>${selected.level}</dd>
      <dt>Parent</dt>
      <dd>${escapeHtml(selected.parentName)}</dd>
      <dt>Material</dt>
      <dd>${escapeHtml(selected.material || "n/a")}</dd>
      <dt>plank_id</dt>
      <dd>${escapeHtml(String(selected.plankId || "n/a"))}</dd>
      <dt>Size</dt>
      <dd>${formatVector(selected.size)}</dd>
      <dt>Local XYZ</dt>
      <dd>${formatVector(selected.localPosition)}</dd>
      <dt>World XYZ</dt>
      <dd>${formatVector(selected.origin)}</dd>
      <dt>Source row</dt>
      <dd>${escapeHtml(selected.row.__raw)}</dd>
    </dl>
  `;
}

function formatVector(vector) {
  return `${vector.x}mm, ${vector.y}mm, ${vector.z}mm`;
}

function updateStatus(message, isError) {
  els.statusBadge.textContent = message;
  els.statusBadge.classList.toggle("error", isError);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function shadeHex(hex, amount) {
  const numeric = Number.parseInt(hex.slice(1), 16);
  const clamp = (channel) => Math.max(0, Math.min(255, channel));
  const red = clamp((numeric >> 16) + amount);
  const green = clamp(((numeric >> 8) & 0xff) + amount);
  const blue = clamp((numeric & 0xff) + amount);
  return `rgb(${red}, ${green}, ${blue})`;
}

function handlePointerDown(event) {
  state.isDragging = true;
  state.dragStartX = event.clientX;
  state.dragStartY = event.clientY;
  state.pointerDownX = event.clientX;
  state.pointerDownY = event.clientY;
  state.didDrag = false;
  els.canvas.classList.add("dragging");
}

function handlePointerMove(event) {
  if (state.isDragging) {
    const deltaX = event.clientX - state.dragStartX;
    const deltaY = event.clientY - state.dragStartY;
    if (Math.abs(event.clientX - state.pointerDownX) > 4 || Math.abs(event.clientY - state.pointerDownY) > 4) {
      state.didDrag = true;
    }
    state.dragStartX = event.clientX;
    state.dragStartY = event.clientY;
    state.yaw += deltaX * 0.008;
    state.pitch = Math.max(-1.35, Math.min(1.35, state.pitch + deltaY * 0.008));
    drawScene();
    return;
  }

  const pointer = getCanvasPoint(event);
  const boxId = pickBox(pointer.x, pointer.y);
  if (boxId !== state.hoveredBoxId) {
    state.hoveredBoxId = boxId;
    drawScene();
  }
}

function handlePointerUp() {
  state.isDragging = false;
  els.canvas.classList.remove("dragging");
}

function handleWheel(event) {
  event.preventDefault();
  const zoomDelta = event.deltaY < 0 ? 1.1 : 0.92;
  state.zoom = Math.max(0.015, Math.min(2, state.zoom * zoomDelta));
  drawScene();
}

function handleClick(event) {
  if (state.didDrag) {
    return;
  }

  const pointer = getCanvasPoint(event);
  const boxId = pickBox(pointer.x, pointer.y);
  if (!boxId) {
    return;
  }

  state.selectedBoxId = boxId;
  renderSelection();
  drawScene();
}

function getCanvasPoint(event) {
  const rect = els.canvas.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top
  };
}

function pickBox(x, y) {
  const faces = [...state.faces].reverse();
  for (const face of faces) {
    if (pointInPolygon({ x, y }, face.points)) {
      return face.boxId;
    }
  }
  return null;
}

function pointInPolygon(point, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;

    const intersects = ((yi > point.y) !== (yj > point.y))
      && (point.x < ((xj - xi) * (point.y - yi)) / ((yj - yi) || 1e-6) + xi);

    if (intersects) {
      inside = !inside;
    }
  }
  return inside;
}

init();
