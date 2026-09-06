// engine/widgets/cylinder.js
// Виджет «Задание 2»: мензурка и сосуды с водой на столе.
// Ученик берёт сосуд и поднимает его к «уровню глаз» (вертикальному
// положению на сцене, отмеченному пунктирной линией) — только там
// деления шкалы не искажены параллаксом и уровень воды можно считать
// точно. Ниже или выше этой линии шкала визуально «съезжает»,
// имитируя ошибку параллакса при взгляде не перпендикулярно мениску.

(function () {

  const EYE_LEVEL_TOLERANCE_PX = 18; // ширина зоны, где параллакс считается нулевым

  // Рисует один сосуд с шкалой и водой внутри общего контейнера.
  // vesselSpec: { minMl, maxMl, divisionMl } — параметры шкалы (для основной
  //   мензурки берутся из lab.cylinder; для доп. сосудов шкалы не рисуем —
  //   у них по методичке нет собственных делений, только сама мензурка мерит).
  function buildVessel(widthPx, heightPx, shape, levelFrac, scaleParams) {
    const container = new PIXI.Container();

    const shadow = LabDraw.dropShadow(widthPx, 14, 0.3);
    shadow.position.set(widthPx / 2, heightPx + 8);

    const glass = LabDraw.drawGlass(widthPx, heightPx, shape);
    const water = LabDraw.drawWater(widthPx, heightPx, levelFrac, shape);

    container.addChild(shadow, glass, water);
    container._labShadow = shadow;
    container._labWater = water;
    container._labGlassH = heightPx;

    if (scaleParams) {
      const scale = LabDraw.drawScale({
        lengthPx: heightPx,
        minVal: scaleParams.minMl,
        maxVal: scaleParams.maxMl,
        divisionVal: scaleParams.divisionMl,
        orientation: 'vertical',
        majorEvery: 5,
        color: 0x2a4a63,
        fontSize: 9,
      });
      // шкала мензурки читается сверху вниз (верх = максимум мл)
      scale.position.set(widthPx + 2, 0);
      scale.scale.y = -1;
      scale.position.y = heightPx;
      container.addChild(scale);
      // Внимание: имя не должно совпадать с зарезервированными приватными
      // полями PIXI.Container (_scale и т.п.) — такое совпадение молча
      // портит внутреннюю трансформацию контейнера и обнуляет его bounds,
      // из-за чего перетаскивание (и любой pointer-hit-test) перестаёт
      // работать без единой видимой ошибки в консоли.
      container._labScaleWidget = scale;
    }

    return container;
  }

  // Подключает задание 2: мензурка (с реальной шкалой) и дополнительные
  // сосуды (колба, пробирка — без своей шкалы, объём считывается только
  // через переливание в мензурку, как и требует методичка).
  //
  // onCylinderRead(valueMl, isAligned): вызывается при перетаскивании
  //   мензурки — сообщает текущее визуальное «показание» с учётом
  //   параллакса и то, выровнен ли сосуд по уровню глаз.
  function attachCylinderTask(lab, scene, rng, callbacks) {
    const { app, layers, width, height } = scene;
    const cyl = lab.cylinder;

    const eyeLevelY = height * 0.2;
    const eyeLine = new PIXI.Graphics();
    eyeLine.moveTo(0, eyeLevelY);
    eyeLine.lineTo(width, eyeLevelY);
    eyeLine.stroke({ width: 1.5, color: 0xc0392b, alpha: 0.55 });
    const eyeLabel = new PIXI.Text({
      text: '👁 уровень глаз — поднимите сосуд сюда для точного отсчёта',
      style: { fontFamily: 'Segoe UI, Arial, sans-serif', fontSize: 11, fill: 0xc0392b },
    });
    eyeLabel.position.set(8, eyeLevelY - 18);
    layers.ui.addChild(eyeLine, eyeLabel);

    // --- Мензурка (основной измерительный прибор задания) -----------------
    const cylW = 60, cylH = 210;
    const cylLevelFrac = (cyl.trueLevelMl - cyl.minMl) / (cyl.maxMl - cyl.minMl);
    const cylContainer = buildVessel(cylW, cylH, 'cylinder', cylLevelFrac, cyl);
    cylContainer.pivot.set(cylW / 2, cylH);
    cylContainer.position.set(width * 0.72, height - 30);
    layers.objects.addChild(cylContainer);

    // Выравнивание считается не по центру сосуда, а по фактическому уровню
    // воды (мениску) внутри него — именно его нужно совместить со взглядом
    // по методичке, а не «сосуд вообще».
    function updateParallax(target, glassH, levelFrac) {
      const bottomY = target.getGlobalPosition().y; // pivot сосуда — его дно
      const waterSurfaceY = bottomY - glassH * levelFrac;
      const dy = waterSurfaceY - eyeLevelY;
      const aligned = Math.abs(dy) <= EYE_LEVEL_TOLERANCE_PX;
      // визуальный сдвиг шкалы пропорционален расстоянию от уровня глаз —
      // чем дальше от eyeLevelY, тем сильнее «съезжают» деления, имитируя
      // ошибку параллакса при взгляде не перпендикулярно мениску
      if (target._labScaleWidget) {
        target._labScaleWidget.skew.x = clamp(dy * 0.006, -0.35, 0.35);
      }
      return { aligned, dy };
    }

    LabScene.makeDraggable(app, cylContainer, {
      onDragMove(target) {
        const { aligned } = updateParallax(target, cylH, cylLevelFrac);
        if (callbacks.onCylinderMove) callbacks.onCylinderMove(aligned);
      },
      onDragEnd(target) {
        const { aligned } = updateParallax(target, cylH, cylLevelFrac);
        if (callbacks.onCylinderSettled) callbacks.onCylinderSettled(aligned);
      },
    });

    // --- Дополнительные сосуды (задание 1.3 — объём в разных ёмкостях) ----
    const vesselShapes = ['flask', 'tube', 'cylinder'];
    lab.vessels.forEach((v, i) => {
      const w = 48 - i * 6;
      const h = 120 - i * 18;
      const frac = 0.55 + rng() * 0.25; // визуальный уровень — реальный объём ученик определяет переливанием в мензурку
      const vc = buildVessel(w, h, vesselShapes[i % vesselShapes.length], frac, null);
      vc.pivot.set(w / 2, h);
      vc.position.set(width * 0.15 + i * 90, height - 30);
      layers.objects.addChild(vc);

      const vLabel = new PIXI.Text({
        text: v.name,
        style: { fontFamily: 'Segoe UI, Arial, sans-serif', fontSize: 10, fill: 0x333333 },
      });
      vLabel.anchor.set(0.5, 0);
      vLabel.position.set(vc.x, height - 16);
      layers.ui.addChild(vLabel);

      LabScene.makeDraggable(app, vc, {});
    });
  }

  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

  window.LabCylinderWidget = { attachCylinderTask };

})();
