
(function () {

// Слой данных общий для всех лаб: генератор варианта, загрузка схемы,
// сохранение прогресса. Отрисовка приборов вынесена в engine/scene.js,
// engine/draw.js и engine/widgets/*.js (Pixi-сцена «лабораторный стол»).

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

window.LabEngine = { mulberry32, getVariantSeed, loadLabSchema, saveProgress, loadProgress };

})();
