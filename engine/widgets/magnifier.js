// engine/widgets/magnifier.js
// Универсальный инструмент «лупа» — кнопка включает режим, в котором
// круглая область у курсора показывает увеличенный фрагмент сцены
// (деления шкалы линейки, шкалы мензурки и т.п.).
//
// Технически: НЕ зависит от Pixi-специфичных механизмов (RenderTexture/
// маски внутри сцены оказались нестабильны в этой версии PixiJS — иногда
// увеличенное содержимое не рендерилось вовсе). Вместо этого — обычный
// HTML5 Canvas 2D элемент поверх основного <canvas>, обрезанный по кругу
// через CSS clip-path, который на каждое движение курсора копирует нужный
// прямоугольник из уже отрисованного основного канваса через drawImage()
// с масштабом — стандартный, предсказуемый браузерный API.

(function () {

  // Подключает лупу к сцене. containerEl — тот же DOM-элемент, в который
  // LabScene.createScene вставил canvas (родитель должен быть
  // position:relative — обеспечивается CSS-классом .scene-wrap).
  // Возвращает { destroy() }.
  // opts: { diameter=110, zoom=3 }
  function attachMagnifier(scene, containerEl, opts) {
    opts = opts || {};
    const diameter = opts.diameter || 110;
    const zoom = opts.zoom || 3;
    const sourceCanvas = scene.app.canvas;

    let active = false;

    const lensEl = document.createElement('div');
    lensEl.className = 'magnifier-lens';
    lensEl.style.width = diameter + 'px';
    lensEl.style.height = diameter + 'px';
    lensEl.hidden = true;

    const lensCanvas = document.createElement('canvas');
    lensCanvas.width = diameter;
    lensCanvas.height = diameter;
    lensEl.appendChild(lensCanvas);
    containerEl.appendChild(lensEl);
    const lensCtx = lensCanvas.getContext('2d');

    function drawAt(clientX, clientY) {
      const rect = sourceCanvas.getBoundingClientRect();
      // Координаты курсора в «логических» пикселях канваса (CSS-размер
      // может отличаться от внутреннего разрешения при autoDensity/DPR).
      const scaleX = sourceCanvas.width / rect.width;
      const scaleY = sourceCanvas.height / rect.height;
      const cx = (clientX - rect.x) * scaleX;
      const cy = (clientY - rect.y) * scaleY;

      const srcSize = diameter / zoom;
      lensCtx.clearRect(0, 0, diameter, diameter);
      lensCtx.drawImage(
        sourceCanvas,
        cx - srcSize / 2, cy - srcSize / 2, srcSize, srcSize,
        0, 0, diameter, diameter
      );

      // позиционируем сам элемент лупы рядом с курсором, в координатах
      // родительского контейнера (containerEl)
      const parentRect = containerEl.getBoundingClientRect();
      lensEl.style.left = (clientX - parentRect.x - diameter / 2) + 'px';
      lensEl.style.top = (clientY - parentRect.y - diameter / 2) + 'px';
    }

    function onMove(e) {
      if (!active) return;
      const point = e.touches ? e.touches[0] : e;
      drawAt(point.clientX, point.clientY);
    }

    function setActive(next) {
      active = next;
      lensEl.hidden = !active;
      sourceCanvas.style.cursor = active ? 'none' : '';
      if (active) {
        // сразу отрисовать в текущей позиции курсора, а не ждать первого move
        const rect = sourceCanvas.getBoundingClientRect();
        drawAt(rect.x + rect.width / 2, rect.y + rect.height / 2);
      }
    }

    sourceCanvas.addEventListener('pointermove', onMove);
    sourceCanvas.addEventListener('pointerdown', onMove);

    return {
      isActive: () => active,
      setActive,
      toggle: () => setActive(!active),
      destroy() {
        sourceCanvas.removeEventListener('pointermove', onMove);
        sourceCanvas.removeEventListener('pointerdown', onMove);
        lensEl.remove();
        sourceCanvas.style.cursor = '';
      },
    };
  }

  window.LabMagnifierWidget = { attachMagnifier };

})();
