// engine/widgets/cylinder.js
// Виджет «Задание 2»: мензурка и сосуды с водой на столе.
// Мензурка стоит неподвижно (как в жизни она стоит на столе) — угол
// взгляда ученика на неё регулируется отдельным слайдером «сверху /
// на уровне глаз / снизу», а не перетаскиванием самого сосуда. При
// уходе от «уровня глаз» видимая форма поверхности воды искажается —
// это и есть параллакс, который методичка описывает словами «глаз на
// уровне мениска», здесь его видно напрямую.
//
// Дополнительные сосуды (колба, пробирка — задание 1.3) остаются
// перетаскиваемыми: это переливание в мензурку, а не считывание по
// шкале, параллакс там не проверяется.

(function () {

  // Рисует один сосуд с шкалой и водой внутри общего контейнера.
  // scaleParams: { minMl, maxMl, divisionMl } — параметры шкалы (для основной
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
        flip: true, // максимум сверху, минимум снизу — как на реальной мензурке
      });
      scale.position.set(widthPx + 2, 0);
      container.addChild(scale);
      // Внимание: имя не должно совпадать с зарезервированными приватными
      // полями PIXI.Container (_scale и т.п.) — такое совпадение молча
      // портит внутреннюю трансформацию контейнера и обнуляет его bounds.
      container._labScaleWidget = scale;
    }

    return container;
  }

  // Подключает задание 2 к сцене. Возвращает { resetAll() } — сбрасывает
  // сосуды на исходные позиции, угол взгляда на «прямо» и очищает поля
  // ввода/таблицу 1.3, связанные с этим заданием.
  //
  // callbacks:
  //   onViewAngleChange(angle, aligned) — angle: -1..0..1, aligned: true
  //     когда |angle| достаточно мал, чтобы считать отсчёт верным.
  function attachCylinderTask(lab, scene, rng, callbacks) {
    callbacks = callbacks || {};
    const { layers, width, height } = scene;
    const cyl = lab.cylinder;

    // --- Мензурка (основной измерительный прибор задания) -----------------
    const cylW = 60, cylH = 210;
    const cylLevelFrac = (cyl.trueLevelMl - cyl.minMl) / (cyl.maxMl - cyl.minMl);
    const cylContainer = buildVessel(cylW, cylH, 'cylinder', cylLevelFrac, cyl);
    cylContainer.pivot.set(cylW / 2, cylH);
    cylContainer.position.set(width * 0.72, height - 30);
    layers.objects.addChild(cylContainer);

    function setViewAngle(angle) {
      cylContainer._labWater.setViewAngle(angle);
      const aligned = Math.abs(angle) < 0.08;
      if (callbacks.onViewAngleChange) callbacks.onViewAngleChange(angle, aligned);
    }
    setViewAngle(0);

    // --- Дополнительные сосуды (задание 1.3 — объём в разных ёмкостях) ----
    const vesselShapes = ['flask', 'tube', 'cylinder'];
    const vessels = [];
    lab.vessels.forEach((v, i) => {
      const w = 48 - i * 6;
      const h = 120 - i * 18;
      const frac = 0.55 + rng() * 0.25; // визуальный уровень — реальный объём ученик определяет переливанием в мензурку
      const vc = buildVessel(w, h, vesselShapes[i % vesselShapes.length], frac, null);
      vc.pivot.set(w / 2, h);
      const startX = width * 0.15 + i * 90;
      const startY = height - 30;
      vc.position.set(startX, startY);
      vc._labStartX = startX;
      vc._labStartY = startY;
      layers.objects.addChild(vc);
      vessels.push(vc);

      const vLabel = new PIXI.Text({
        text: v.name,
        style: { fontFamily: 'Segoe UI, Arial, sans-serif', fontSize: 10, fill: 0x333333 },
      });
      vLabel.anchor.set(0.5, 0);
      vLabel.position.set(vc.x, height - 16);
      layers.ui.addChild(vLabel);

      LabScene.makeDraggable(scene.app, vc, {});
    });

    return {
      setViewAngle,
      resetAll() {
        setViewAngle(0);
        vessels.forEach((vc) => vc.position.set(vc._labStartX, vc._labStartY));
      },
    };
  }

  window.LabCylinderWidget = { attachCylinderTask };

})();
