// engine/widgets/submersion.js
// Виджет «Задание: объём твёрдого тела погружением в воду». Реализует
// оба способа из методички физически честно, но интерактивно:
//
//  Способ А (по разности уровней) — мензурка наполнена водой на 2/3.
//    Ученик перетаскивает тело мышью и отпускает его над мензуркой —
//    тело «тонет», уровень воды поднимается на объём тела (V2 - V1).
//    Показания V1 и V2 ученик снимает сам по шкале, как и раньше.
//
//  Способ Б (отливной сосуд) — сосуд наполнен ровно до трубки-носика.
//    Ученик перетаскивает то же тело в отливной сосуд — вытесненная
//    вода анимированной струйкой перетекает в пустую мензурку рядом,
//    и её объём читается прямо со шкалы (Vт = Vж).
//
// Оба способа используют одну и ту же механику «взял мышью — отпустил
// над сосудом — тело погрузилось», как переливание в задании 1.

(function () {

  const SINK_DURATION_MS = 550;
  const POUR_DURATION_MS = 1400;

  function buildBody(body, size) {
    const c = LabDraw.drawSolidBody(body.shape, size);
    const shadow = LabDraw.dropShadow(size, size * 0.4, 0.3);
    shadow.position.set(size / 2, size + 4);
    c.addChildAt(shadow, 0);
    c._labShadow = shadow;

    const label = new PIXI.Text({
      text: body.name,
      style: { fontFamily: 'Segoe UI, Arial, sans-serif', fontSize: 10, fill: 0x333333 },
    });
    label.anchor.set(0.5, 0);
    label.position.set(size / 2, size + 8);
    c.addChild(label);

    c._labBodyId = body.id;
    c._labVolumeMl = body.volumeMl;
    c._labSize = size;
    return c;
  }

  // Мензурка способа А — так же, как в задании 1, но без сосудов-«стаканов»
  // рядом: единственный источник объёма здесь — погружаемое тело.
  function buildCylinder(cylW, cylH, levelFrac, scaleParams) {
    const container = new PIXI.Container();
    const shadow = LabDraw.dropShadow(cylW, 14, 0.3);
    shadow.position.set(cylW / 2, cylH + 8);
    const glass = LabDraw.drawGlass(cylW, cylH, 'cylinder');
    const water = LabDraw.drawWater(cylW, cylH, levelFrac, 'cylinder');
    container.addChild(shadow, glass, water);
    container._labWater = water;
    container._labLevelFrac = levelFrac;

    const scale = LabDraw.drawScale({
      lengthPx: cylH,
      minVal: scaleParams.minMl, maxVal: scaleParams.maxMl, divisionVal: scaleParams.divisionMl,
      orientation: 'vertical', majorEvery: 5, color: 0x2a4a63, fontSize: 9, flip: true,
    });
    scale.position.set(cylW + 2, 0);
    container.addChild(scale);
    return container;
  }

  // Подключает задание к сцене. lab.bodies — общий список тел, который
  // ученик по очереди опускает сначала в мензурку (способ А), потом в
  // отливной сосуд (способ Б); каждое тело можно использовать в обоих
  // способах независимо (положение и состояние в способе А не влияют на Б).
  //
  // callbacks:
  //   onSinkA(bodyId, v1Ml, v2Ml) — тело утонуло в мензурке; v1Ml — уровень
  //     ДО погружения (наливка «на 2/3»), v2Ml — уровень ПОСЛЕ.
  //   onPourB(bodyId, volumeMl) — тело погружено в отливной сосуд, объём
  //     вылившейся (и уже перелитой в мензурку) воды известен напрямую.
  function attachSubmersionTask(lab, sceneA, sceneB, rng, callbacks) {
    callbacks = callbacks || {};
    const bodySize = 34;

    // ================= Способ А: разность уровней =================
    (function setupSceneA() {
      const { app, layers, width, height } = sceneA;
      const cyl = lab.cylinder;
      const cylW = 64, cylH = 200;
      const startFrac = cyl.fillFrac;

      const cylContainer = buildCylinder(cylW, cylH, startFrac, cyl);
      cylContainer.pivot.set(cylW / 2, cylH);
      cylContainer.position.set(width * 0.62, height - 30);
      layers.objects.addChild(cylContainer);

      let sunkVolume = 0; // суммарный объём уже утопленных тел — уровень растёт по мере опытов
      const sunkIds = new Set();
      const bodies = [];

      lab.bodies.forEach((b, i) => {
        const bc = buildBody(b, bodySize);
        const startX = 30 + i * 70;
        const startY = height - 34;
        bc.pivot.set(bodySize / 2, bodySize / 2);
        bc.position.set(startX, startY);
        bc._labStartX = startX;
        bc._labStartY = startY;
        layers.objects.addChild(bc);
        bodies.push(bc);

        LabScene.makeDraggable(app, bc, {
          onDragMove: () => sceneA.notifyChanged(),
          onDragEnd() {
            trySink(bc);
            sceneA.notifyChanged();
          },
        });
      });

      function trySink(bc) {
        if (sunkIds.has(bc._labBodyId)) return; // уже погружено — не топим дважды
        const local = cylContainer.toLocal(bc.getGlobalPosition());
        const overCylinder = local.x > -10 && local.x < cylW + 10 && local.y > -30 && local.y < cylH + 20;
        if (!overCylinder) return;

        sunkIds.add(bc._labBodyId);
        const v1 = cyl.minMl + startFrac * (cyl.maxMl - cyl.minMl) + sunkVolume;
        sunkVolume += bc._labVolumeMl;
        const v2 = cyl.minMl + startFrac * (cyl.maxMl - cyl.minMl) + sunkVolume;
        const targetFrac = (v2 - cyl.minMl) / (cyl.maxMl - cyl.minMl);

        // Тело плавно уходит под воду и «прилипает» ко дну цилиндра —
        // визуально остаётся видно, что оно погружено, а не исчезло.
        const fromFrac = cylContainer._labLevelFrac;
        const targetLocal = { x: cylW / 2 - bc._labSize / 2, y: cylH - bc._labSize * (0.5 + 0.12 * sunkIds.size) };
        const targetGlobal = cylContainer.toGlobal(new PIXI.Point(targetLocal.x + bc._labSize / 2, targetLocal.y + bc._labSize / 2));
        const startPos = { x: bc.x, y: bc.y };
        const startParent = bc.parent;
        const localTarget = startParent.toLocal(targetGlobal);

        const t0 = performance.now();
        function step() {
          const t = Math.min(1, (performance.now() - t0) / SINK_DURATION_MS);
          const eased = 1 - Math.pow(1 - t, 2);
          bc.x = startPos.x + (localTarget.x - startPos.x) * eased;
          bc.y = startPos.y + (localTarget.y - startPos.y) * eased;
          bc.alpha = 1 - 0.25 * eased; // чуть притемняется — «под водой»
          cylContainer._labWater.setLevel(fromFrac + (targetFrac - fromFrac) * eased);
          cylContainer._labLevelFrac = fromFrac + (targetFrac - fromFrac) * eased;
          sceneA.notifyChanged();
          if (t < 1) requestAnimationFrame(step);
          else if (callbacks.onSinkA) callbacks.onSinkA(bc._labBodyId, v1, v2);
        }
        requestAnimationFrame(step);
      }

      sceneA.setRebuilder((root) => {
        const cCopy = buildCylinder(cylW, cylH, cylContainer._labLevelFrac, cyl);
        cCopy.pivot.set(cylW / 2, cylH);
        cCopy.position.set(cylContainer.x, cylContainer.y);
        root.addChild(cCopy);
        bodies.forEach((bc) => {
          const copy = buildBody(lab.bodies.find(b => b.id === bc._labBodyId), bodySize);
          copy.pivot.set(bodySize / 2, bodySize / 2);
          copy.position.set(bc.x, bc.y);
          copy.alpha = bc.alpha;
          root.addChild(copy);
        });
      });

      sceneA._resetAll = () => {
        sunkVolume = 0;
        sunkIds.clear();
        cylContainer._labWater.setLevel(startFrac);
        cylContainer._labLevelFrac = startFrac;
        bodies.forEach((bc) => {
          bc.position.set(bc._labStartX, bc._labStartY);
          bc.alpha = 1;
        });
        sceneA.notifyChanged();
      };
    })();

    // ================= Способ Б: отливной сосуд =================
    (function setupSceneB() {
      const { app, layers, width, height } = sceneB;
      const spoutCyl = lab.spoutCylinder;
      const vesselW = 90, vesselH = 130;
      const catchCylW = 46, catchCylH = 150;

      const vessel = LabDraw.drawSpoutVessel(vesselW, vesselH);
      vessel.pivot.set(vesselW / 2, vesselH);
      vessel.position.set(width * 0.28, height - 30);
      layers.objects.addChild(vessel);

      const catchShadow = LabDraw.dropShadow(catchCylW, 14, 0.3);
      const catchGlass = LabDraw.drawGlass(catchCylW, catchCylH, 'cylinder');
      const catchWater = LabDraw.drawWater(catchCylW, catchCylH, 0, 'cylinder');
      const catchScale = LabDraw.drawScale({
        lengthPx: catchCylH, minVal: spoutCyl.minMl, maxVal: spoutCyl.maxMl, divisionVal: spoutCyl.divisionMl,
        orientation: 'vertical', majorEvery: 5, color: 0x2a4a63, fontSize: 9, flip: true,
      });
      const catchContainer = new PIXI.Container();
      catchShadow.position.set(catchCylW / 2, catchCylH + 8);
      catchScale.position.set(catchCylW + 2, 0);
      catchContainer.addChild(catchShadow, catchGlass, catchWater, catchScale);
      catchContainer.pivot.set(catchCylW / 2, catchCylH);
      catchContainer.position.set(width * 0.66, height - 30);
      catchContainer._labWater = catchWater;
      catchContainer._labLevelFrac = 0;
      layers.objects.addChild(catchContainer);

      // Трубка, физически соединяющая носик отливного сосуда с горлышком
      // мензурки-приёмника — вода видимо течёт по ней, а не телепортируется
      // между сосудами. Оба конца переведены в координаты layers.objects
      // (общий родитель обоих сосудов, без собственного масштаба/поворота,
      // поэтому позиция+pivot достаточно — toGlobal/toLocal не нужны).
      const spoutTipLocal = vessel._labSpoutTip; // локально в vessel, до pivot/position
      const tubeFrom = {
        x: vessel.x - vessel.pivot.x + spoutTipLocal.x,
        y: vessel.y - vessel.pivot.y + spoutTipLocal.y,
      };
      const tubeTo = {
        x: catchContainer.x - catchContainer.pivot.x + catchCylW / 2,
        y: catchContainer.y - catchContainer.pivot.y,
      };
      const tube = LabDraw.drawTube(tubeFrom, tubeTo, { radius: 4 });
      layers.tools.addChild(tube); // под сосудами и телами (layers.objects рисуется поверх)
      const tubeFlow = LabDraw.createTubeFlow(tube, { radius: 4 });

      let pouredVolume = 0;
      let currentFlowT = 0; // текущее наполнение видимой трубки — нужно копии для лупы
      const pouredIds = new Set();
      const bodies = [];

      const bodiesStartX = catchContainer.x + catchCylW + 50;
      lab.bodies.forEach((b, i) => {
        const bc = buildBody(b, bodySize);
        const startX = bodiesStartX + (i % 2) * (bodySize + 26);
        const startY = height - 34 - Math.floor(i / 2) * (bodySize + 26);
        bc.pivot.set(bodySize / 2, bodySize / 2);
        bc.position.set(startX, startY);
        bc._labStartX = startX;
        bc._labStartY = startY;
        layers.objects.addChild(bc);
        bodies.push(bc);

        LabScene.makeDraggable(app, bc, {
          onDragMove: () => sceneB.notifyChanged(),
          onDragEnd() {
            tryPour(bc);
            sceneB.notifyChanged();
          },
        });
      });

      function tryPour(bc) {
        if (pouredIds.has(bc._labBodyId)) return;
        const local = vessel.toLocal(bc.getGlobalPosition());
        const overVessel = local.x > -10 && local.x < vesselW + 10 && local.y > -30 && local.y < vesselH + 20;
        if (!overVessel) return;

        pouredIds.add(bc._labBodyId);
        const fromCatchFrac = catchContainer._labLevelFrac;
        pouredVolume += bc._labVolumeMl;
        const targetCatchFrac = (pouredVolume - spoutCyl.minMl) / (spoutCyl.maxMl - spoutCyl.minMl);

        // Тело уходит в сосуд (тонет к его дну), одновременно из носика в
        // мензурку «льётся» вытесненный объём — та же логика переливания,
        // что и в задании 1, но управляется погружением, а не кликом.
        const targetLocal = { x: vesselW / 2 - bc._labSize / 2, y: vesselH - bc._labSize * 0.6 };
        const targetGlobal = vessel.toGlobal(new PIXI.Point(targetLocal.x + bc._labSize / 2, targetLocal.y + bc._labSize / 2));
        const startPos = { x: bc.x, y: bc.y };
        const localTarget = bc.parent.toLocal(targetGlobal);

        const t0 = performance.now();
        function step() {
          const t = Math.min(1, (performance.now() - t0) / POUR_DURATION_MS);
          const eased = 1 - Math.pow(1 - t, 2);
          bc.x = startPos.x + (localTarget.x - startPos.x) * eased;
          bc.y = startPos.y + (localTarget.y - startPos.y) * eased;
          bc.alpha = 1 - 0.3 * eased;
          catchContainer._labWater.setLevel(fromCatchFrac + (targetCatchFrac - fromCatchFrac) * eased);
          catchContainer._labLevelFrac = fromCatchFrac + (targetCatchFrac - fromCatchFrac) * eased;
          // Труба заполняется почти сразу, как тело начало погружаться (вода
          // вытесняется немедленно), и опустевает под конец, когда последняя
          // порция уже дотекла до мензурки — видимый поток, а не телепорт.
          currentFlowT = t < 0.15 ? t / 0.15 : (t > 0.85 ? (1 - t) / 0.15 : 1);
          tubeFlow.setProgress(currentFlowT);
          sceneB.notifyChanged();
          if (t < 1) {
            requestAnimationFrame(step);
          } else {
            currentFlowT = 0;
            if (callbacks.onPourB) callbacks.onPourB(bc._labBodyId, bc._labVolumeMl);
          }
        }
        requestAnimationFrame(step);
      }

      sceneB.setRebuilder((root) => {
        // Трубка рисуется первой — она должна лежать под сосудами и телами,
        // как и на основной сцене (layers.tools ниже layers.objects).
        const tubeCopy = LabDraw.drawTube(tubeFrom, tubeTo, { radius: 4 });
        root.addChild(tubeCopy);
        LabDraw.createTubeFlow(tubeCopy, { radius: 4 }).setProgress(currentFlowT);

        const vCopy = LabDraw.drawSpoutVessel(vesselW, vesselH);
        vCopy.pivot.set(vesselW / 2, vesselH);
        vCopy.position.set(vessel.x, vessel.y);
        root.addChild(vCopy);

        const ccCopy = new PIXI.Container();
        const s2 = LabDraw.dropShadow(catchCylW, 14, 0.3);
        s2.position.set(catchCylW / 2, catchCylH + 8);
        const g2 = LabDraw.drawGlass(catchCylW, catchCylH, 'cylinder');
        const w2 = LabDraw.drawWater(catchCylW, catchCylH, catchContainer._labLevelFrac, 'cylinder');
        const sc2 = LabDraw.drawScale({
          lengthPx: catchCylH, minVal: spoutCyl.minMl, maxVal: spoutCyl.maxMl, divisionVal: spoutCyl.divisionMl,
          orientation: 'vertical', majorEvery: 5, color: 0x2a4a63, fontSize: 9, flip: true,
        });
        sc2.position.set(catchCylW + 2, 0);
        ccCopy.addChild(s2, g2, w2, sc2);
        ccCopy.pivot.set(catchCylW / 2, catchCylH);
        ccCopy.position.set(catchContainer.x, catchContainer.y);
        root.addChild(ccCopy);

        bodies.forEach((bc) => {
          const copy = buildBody(lab.bodies.find(b => b.id === bc._labBodyId), bodySize);
          copy.pivot.set(bodySize / 2, bodySize / 2);
          copy.position.set(bc.x, bc.y);
          copy.alpha = bc.alpha;
          root.addChild(copy);
        });
      });

      sceneB._resetAll = () => {
        pouredVolume = 0;
        pouredIds.clear();
        catchContainer._labWater.setLevel(0);
        catchContainer._labLevelFrac = 0;
        bodies.forEach((bc) => {
          bc.position.set(bc._labStartX, bc._labStartY);
          bc.alpha = 1;
        });
        sceneB.notifyChanged();
      };
    })();

    return {
      resetAll() {
        sceneA._resetAll();
        sceneB._resetAll();
      },
    };
  }

  window.LabSubmersionWidget = { attachSubmersionTask };

})();
