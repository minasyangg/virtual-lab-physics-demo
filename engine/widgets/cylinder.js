// engine/widgets/cylinder.js
// Виджет «Задание 2»: измерительный цилиндр (мензурка) и три сосуда
// с водой на столе (мензурка/колба/пробирка из lab.vessels — задание
// 1.3). Измерительный цилиндр стоит неподвижно и начинает пустым: как
// того требует методичка («перелейте воду из стакана»), показание
// появляется только после того, как ученик кликнет по одному из
// сосудов — его содержимое переливается в цилиндр анимацией, и уже по
// цилиндру со шкалой считывается объём.
//
// Угол взгляда ученика на цилиндр регулируется отдельным слайдером
// «сверху / на уровне глаз / снизу», а не перетаскиванием сосуда. При
// уходе от «уровня глаз» видимая форма поверхности воды искажается —
// это и есть параллакс, который методичка описывает словами «глаз на
// уровне мениска», здесь его видно напрямую.

(function () {

  const POUR_DURATION_MS = 500;

  // Рисует один сосуд с шкалой и водой внутри общего контейнера.
  // scaleParams: { minMl, maxMl, divisionMl } — параметры шкалы (только у
  //   измерительного цилиндра; сосуды-«стаканы» задания 1.3 своей шкалы
  //   не имеют — их объём узнают только переливанием в цилиндр).
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
    container._labLevelFrac = levelFrac;

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
  // цилиндр к пустому состоянию, все сосуды к исходному полному объёму,
  // угол взгляда на «прямо».
  //
  // callbacks:
  //   onViewAngleChange(angle, aligned) — angle: -1..0..1, aligned: true
  //     когда |angle| достаточно мал, чтобы считать отсчёт верным.
  //   onPour(vesselIndex, volumeMl) — вызывается, когда переливание в
  //     цилиндр завершено (анимация наполнения закончилась); volumeMl —
  //     реальный объём, который теперь нужно сверять с показанием ученика.
  function attachCylinderTask(lab, scene, rng, callbacks) {
    callbacks = callbacks || {};
    const { layers, width, height } = scene;
    const cyl = lab.cylinder;

    // --- Измерительный цилиндр: стоит неподвижно, изначально пуст --------
    const cylW = 60, cylH = 210;
    const cylContainer = buildVessel(cylW, cylH, 'cylinder', 0, cyl);
    cylContainer.pivot.set(cylW / 2, cylH);
    cylContainer.position.set(width * 0.72, height - 30);
    layers.objects.addChild(cylContainer);

    let currentViewAngle = 0;

    function setViewAngle(angle) {
      currentViewAngle = angle;
      cylContainer._labWater.setViewAngle(angle);
      const aligned = Math.abs(angle) < 0.08;
      scene.notifyChanged();
      if (callbacks.onViewAngleChange) callbacks.onViewAngleChange(angle, aligned);
    }
    setViewAngle(0);

    // --- Сосуды-«стаканы» (задание 1.3 — переливание в цилиндр) ----------
    const vesselShapes = ['flask', 'tube', 'cylinder'];
    const vessels = [];
    let pouring = false; // блокирует повторный клик во время анимации

    lab.vessels.forEach((v, i) => {
      const w = 48 - i * 6;
      const h = 120 - i * 18;
      const startFrac = 0.7 + rng() * 0.2; // сосуд визуально полон до переливания
      const vc = buildVessel(w, h, vesselShapes[i % vesselShapes.length], startFrac, null);
      vc.pivot.set(w / 2, h);
      const startX = width * 0.15 + i * 90;
      const startY = height - 30;
      vc.position.set(startX, startY);
      vc._labStartX = startX;
      vc._labStartY = startY;
      vc._labStartFrac = startFrac;
      vc._labVolumeMl = v.trueVolumeMl;
      layers.objects.addChild(vc);
      vessels.push(vc);

      const vLabel = new PIXI.Text({
        text: v.name,
        style: { fontFamily: 'Segoe UI, Arial, sans-serif', fontSize: 10, fill: 0x333333 },
      });
      vLabel.anchor.set(0.5, 0);
      vLabel.position.set(vc.x, height - 16);
      layers.ui.addChild(vLabel);

      // Кликабельно (не перетаскиваемо) — клик переливает содержимое
      // сосуда в измерительный цилиндр. Лёгкая подсветка при наведении
      // подсказывает, что предмет интерактивен именно так, а не через drag.
      vc.eventMode = 'static';
      vc.cursor = 'pointer';
      vc.on('pointerover', () => { vc.alpha = 0.85; });
      vc.on('pointerout', () => { vc.alpha = 1; });
      vc.on('pointertap', () => pourInto(vc, i));
    });

    function pourInto(vc, vesselIndex) {
      if (pouring || vc._labLevelFrac <= 0) return;
      pouring = true;

      const targetCylFrac = (vc._labVolumeMl - cyl.minMl) / (cyl.maxMl - cyl.minMl);

      function startPour() {
        // сосуд пустеет, цилиндр наполняется — одновременно, единая анимация
        const fromVessel = vc._labLevelFrac;
        const fromCyl = cylContainer._labLevelFrac;
        LabScene.tweenWaterLevel(scene.app, vc._labWater, fromVessel, 0, POUR_DURATION_MS, () => {
          vc._labLevelFrac = 0;
        });
        LabScene.tweenWaterLevel(scene.app, cylContainer._labWater, fromCyl, targetCylFrac, POUR_DURATION_MS, () => {
          cylContainer._labLevelFrac = targetCylFrac;
          vc._labLevelFrac = 0;
          pouring = false;
          scene.notifyChanged();
          if (callbacks.onPour) callbacks.onPour(vesselIndex, vc._labVolumeMl);
        });
        // Пока идёт анимация, картинка под лупой должна литься так же
        // плавно, как на столе, — иначе уровень под стеклом прыгнет разом
        // в конце. Обновляем оба уровня по ходу.
        trackPour(fromVessel, fromCyl, targetCylFrac, vc);
      }

      // Прокидывает промежуточные значения уровней в _labLevelFrac, пока
      // идёт анимация: копия для лупы строится именно по ним.
      function trackPour(fromVessel, fromCyl, toCyl, vessel) {
        const start = performance.now();
        function step() {
          const t = Math.min(1, (performance.now() - start) / POUR_DURATION_MS);
          const eased = 1 - Math.pow(1 - t, 2);
          vessel._labLevelFrac = fromVessel + (0 - fromVessel) * eased;
          cylContainer._labLevelFrac = fromCyl + (toCyl - fromCyl) * eased;
          scene.notifyChanged();
          if (t < 1) requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
      }

      // Если в цилиндре уже что-то есть от предыдущего переливания —
      // сначала быстро опустошаем его, потом наливаем новое: так каждое
      // измерение независимо, объёмы не складываются.
      if (cylContainer._labLevelFrac > 0) {
        const fromCyl = cylContainer._labLevelFrac;
        const clearMs = POUR_DURATION_MS * 0.4;
        LabScene.tweenWaterLevel(scene.app, cylContainer._labWater, fromCyl, 0, clearMs, () => {
          cylContainer._labLevelFrac = 0;
          scene.notifyChanged();
          startPour();
        });
        (function trackClear() {
          const start = performance.now();
          function step() {
            const t = Math.min(1, (performance.now() - start) / clearMs);
            const eased = 1 - Math.pow(1 - t, 2);
            cylContainer._labLevelFrac = fromCyl * (1 - eased);
            scene.notifyChanged();
            if (t < 1) requestAnimationFrame(step);
          }
          requestAnimationFrame(step);
        })();
      } else {
        startPour();
      }
    }

    // Копия содержимого для лупы: цилиндр и сосуды заново, с текущими
    // уровнями воды и текущим углом взгляда — чтобы под стеклом был виден
    // ровно тот же мениск, что и на столе.
    scene.setRebuilder((root) => {
      const c = buildVessel(cylW, cylH, 'cylinder', cylContainer._labLevelFrac, cyl);
      c.pivot.set(cylW / 2, cylH);
      c.position.set(cylContainer.x, cylContainer.y);
      c._labWater.setViewAngle(currentViewAngle);
      root.addChild(c);

      vessels.forEach((vc, i) => {
        const w = 48 - i * 6;
        const h = 120 - i * 18;
        const copy = buildVessel(w, h, vesselShapes[i % vesselShapes.length], vc._labLevelFrac, null);
        copy.pivot.set(w / 2, h);
        copy.position.set(vc.x, vc.y);
        root.addChild(copy);
      });
    });

    return {
      setViewAngle,
      resetAll() {
        setViewAngle(0);
        pouring = false;
        cylContainer._labWater.setLevel(0);
        cylContainer._labLevelFrac = 0;
        vessels.forEach((vc) => {
          vc.position.set(vc._labStartX, vc._labStartY);
          vc._labWater.setLevel(vc._labStartFrac);
          vc._labLevelFrac = vc._labStartFrac;
        });
        scene.notifyChanged();
      },
    };
  }

  window.LabCylinderWidget = { attachCylinderTask };

})();
