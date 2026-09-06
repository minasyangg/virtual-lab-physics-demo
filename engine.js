
function mulberry32(seed) {
  return function() {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function getVariantSeed() {
  const params = new URLSearchParams(location.search);
  let seed = params.get('variant');
  if (!seed) {
    seed = localStorage.getItem('lab_variant_seed');
  }
  if (!seed) {
    seed = String(Math.floor(Math.random() * 1e6));
    localStorage.setItem('lab_variant_seed', seed);
  }
  return parseInt(seed, 10);
}

async function loadLabSchema(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Не удалось загрузить схему лабы: ' + url);
  return res.json();
}

function saveProgress(labId, data) {
  localStorage.setItem('lab_progress_' + labId, JSON.stringify(data));
}
function loadProgress(labId) {
  const raw = localStorage.getItem('lab_progress_' + labId);
  return raw ? JSON.parse(raw) : {};
}

function renderRuler(container, ruler, objectTrueLength, rng, onMeasured) {
  const pxPerCm = 30;
  const rulerLenPx = ruler.lengthCm * pxPerCm;
  const objLenPx = objectTrueLength * pxPerCm;
  const svgW = rulerLenPx + 60;
  const svgH = 110;

  const wrap = document.createElement('div');
  wrap.className = 'ruler-svg-wrap';
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('width', svgW);
  svg.setAttribute('height', svgH);
  svg.style.userSelect = 'none';

  const maxOffset = Math.max(0, rulerLenPx - objLenPx - 10);
  let offsetPx = rng() * maxOffset;

  const objY = 70;
  const rulerY = 20;

  function drawRulerScale() {
    let g = '';
    const divPx = ruler.divisionCm * pxPerCm;
    const numDivs = Math.round(ruler.lengthCm / ruler.divisionCm);
    for (let i = 0; i <= numDivs; i++) {
      const x = 30 + i * divPx;
      const isCm = Math.abs((i * ruler.divisionCm) % 1) < 1e-6;
      const tickH = isCm ? 18 : 10;
      g += `<line x1="${x}" y1="${rulerY}" x2="${x}" y2="${rulerY + tickH}" stroke="#3d2b6e" stroke-width="1"/>`;
      if (isCm) {
        g += `<text x="${x}" y="${rulerY - 4}" font-size="10" text-anchor="middle" fill="#3d2b6e">${Math.round(i*ruler.divisionCm)}</text>`;
      }
    }
    g += `<rect x="30" y="${rulerY}" width="${rulerLenPx}" height="6" fill="#e8e2fb" stroke="#3d2b6e"/>`;
    return g;
  }

  svg.innerHTML = drawRulerScale() +
    `<rect id="obj-bar" x="${30+offsetPx}" y="${objY}" width="${objLenPx}" height="14" rx="3" fill="#6d4fd6" stroke="#3d2b6e" style="cursor:grab"/>` +
    `<text x="${30+offsetPx+objLenPx/2}" y="${objY+30}" font-size="10" text-anchor="middle" fill="#555">двигайте предмет мышью</text>`;

  wrap.appendChild(svg);
  container.appendChild(wrap);

  const bar = svg.querySelector('#obj-bar');
  let dragging = false, startX = 0, startOffset = offsetPx;

  function clamp(v) { return Math.max(0, Math.min(maxOffset, v)); }

  bar.addEventListener('pointerdown', (e) => {
    dragging = true; startX = e.clientX; startOffset = offsetPx;
    bar.setPointerCapture(e.pointerId);
    bar.style.cursor = 'grabbing';
  });
  bar.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    offsetPx = clamp(startOffset + dx);
    bar.setAttribute('x', 30 + offsetPx);
  });
  bar.addEventListener('pointerup', () => {
    dragging = false; bar.style.cursor = 'grab';
    reportMeasurement();
  });

  const resultLine = document.createElement('div');
  resultLine.className = 'result-line';
  container.appendChild(resultLine);

  function reportMeasurement() {
    const leftReadingCm = offsetPx / pxPerCm;
    const rightReadingCm = (offsetPx + objLenPx) / pxPerCm;
    const measuredLength = rightReadingCm - leftReadingCm;
    resultLine.innerHTML = `Начало: <span class="val">${leftReadingCm.toFixed(1)} см</span>,
      конец: <span class="val">${rightReadingCm.toFixed(1)} см</span>,
      длина: <span class="val">${measuredLength.toFixed(1)} см</span>`;
    onMeasured(measuredLength);
  }
  reportMeasurement();
}

function renderCylinder(container, cyl, trueVolumeMl, rng, onRead) {
  const w = 90, h = 260;
  const scaleTopMl = cyl.maxMl, scaleBottomMl = cyl.minMl;
  const fillHeightPx = (h - 20) * (trueVolumeMl - scaleBottomMl) / (scaleTopMl - scaleBottomMl);

  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('width', w + 50);
  svg.setAttribute('height', h + 20);

  let ticks = '';
  const numDivs = Math.round((cyl.maxMl - cyl.minMl) / cyl.divisionMl);
  for (let i = 0; i <= numDivs; i++) {
    const val = cyl.minMl + i * cyl.divisionMl;
    const y = 10 + (h - 20) * (1 - (val - cyl.minMl) / (cyl.maxMl - cyl.minMl));
    const isMajor = (val % (cyl.divisionMl * 5) === 0);
    ticks += `<line x1="30" y1="${y}" x2="${isMajor ? 45 : 38}" y2="${y}" stroke="#3d2b6e" stroke-width="1"/>`;
    if (isMajor) ticks += `<text x="48" y="${y+3}" font-size="9" fill="#3d2b6e">${val}</text>`;
  }

  svg.innerHTML = `
    <rect x="15" y="10" width="30" height="${h-20}" fill="#eef" stroke="#3d2b6e" stroke-width="1.5"/>
    <rect x="15" y="${10 + (h-20-fillHeightPx)}" width="30" height="${fillHeightPx}" fill="#7fb8e8" opacity="0.75"/>
    <line x1="15" y1="${10 + (h-20-fillHeightPx)}" x2="45" y2="${10 + (h-20-fillHeightPx)}" stroke="#2266aa" stroke-width="1.5" stroke-dasharray="2,2"/>
    ${ticks}
  `;
  container.appendChild(svg);

  const readout = document.createElement('div');
  readout.className = 'readout';
  readout.innerHTML = `<label>Ваше показание уровня (мл): <input type="number" step="${cyl.divisionMl}" style="width:80px" id="cyl-read"/></label> <span class="status" id="cyl-status"></span>`;
  container.appendChild(readout);

  const input = readout.querySelector('#cyl-read');
  const status = readout.querySelector('#cyl-status');
  input.addEventListener('input', () => {
    const v = parseFloat(input.value);
    const tolerance = cyl.divisionMl;
    if (!isNaN(v) && Math.abs(v - trueVolumeMl) <= tolerance) {
      status.textContent = '✓ верно (в пределах точности прибора)';
      status.className = 'status ok';
    } else if (!isNaN(v)) {
      status.textContent = '✗ проверьте отсчёт по мениску';
      status.className = 'status bad';
    } else {
      status.textContent = '';
    }
    onRead(v);
  });
}

window.LabEngine = { mulberry32, getVariantSeed, loadLabSchema, saveProgress, loadProgress, renderRuler, renderCylinder };
