// engine/widgets/zoomable.js
// Двойной клик по предмету — увеличить, ещё раз — вернуть обычный размер.
// Нужен, чтобы мелкие тела (гайка, болт, шарик) можно было рассмотреть, не
// таская к ним лупу.
//
// ВАЖНО про физику. Масштаб здесь — чисто визуальная надстройка, и включать
// его можно только там, где размер предмета на экране ни на что не влияет.
// В задании 2 («объём тела») это так: объём каждого тела задан в lab.json,
// а не выводится из пикселей, поэтому увеличенная гайка вытесняет столько
// же воды, сколько обычная — как и должно быть.
// Обратный пример — предметы в задании с линейкой: там измеряемая длина
// СЧИТАЕТСЯ по пиксельному размеру предмета относительно шкалы, и зум либо
// врал бы (предмет видимо длиннее, а меряется прежним), либо позволял бы
// «растянуть карандаш» до любого ответа. Поэтому к линейке этот виджет
// намеренно не подключён.
//
// Зум не мешает остальным взаимодействиям: перетаскивание, попадание в
// зону сосуда и анимации работают через те же координаты центра предмета,
// а pivot стоит в центре, поэтому предмет растёт «из себя», не сдвигаясь.

(function () {

  const DEFAULTS = { zoom: 2, durationMs: 180 };

  // target: PIXI.Container с pivot в центре (иначе предмет «уедет» при зуме)
  // opts: { zoom, durationMs, onChange }
  function makeZoomable(target, opts) {
    opts = opts || {};
    const zoom = opts.zoom || DEFAULTS.zoom;
    const durationMs = opts.durationMs || DEFAULTS.durationMs;
    const baseScale = target.scale.x || 1;

    let zoomed = false;
    let animating = false;

    target.eventMode = 'static';

    function animateTo(targetScale) {
      if (animating) return;
      animating = true;
      const from = target.scale.x;
      const t0 = performance.now();
      function step() {
        const t = Math.min(1, (performance.now() - t0) / durationMs);
        const eased = 1 - Math.pow(1 - t, 2);
        const s = from + (targetScale - from) * eased;
        target.scale.set(s);
        // Тень под предметом растёт вместе с ним, иначе увеличенный предмет
        // выглядит парящим над своей маленькой тенью.
        if (opts.onChange) opts.onChange(target);
        if (t < 1) requestAnimationFrame(step);
        else animating = false;
      }
      requestAnimationFrame(step);
    }

    // Своё распознавание двойного клика: Pixi не даёт готового события, а
    // навешивать dblclick на канву нельзя — она общая для всех предметов.
    let lastTapAt = 0;
    target.on('pointertap', () => {
      const now = performance.now();
      if (now - lastTapAt < 320) {
        zoomed = !zoomed;
        animateTo(zoomed ? baseScale * zoom : baseScale);
        lastTapAt = 0; // третий клик подряд не считается новым двойным
      } else {
        lastTapAt = now;
      }
    });

    return {
      isZoomed() { return zoomed; },
      // Состояние зума переживает сброс задания — предмет возвращается на
      // место, но остаётся увеличенным, если ученик его таким оставил.
      // reset() нужен, только когда состояние надо снять принудительно.
      reset() {
        zoomed = false;
        target.scale.set(baseScale);
      },
      getScaleFactor() { return zoomed ? zoom : 1; },
    };
  }

  window.LabZoomable = { makeZoomable };

})();
