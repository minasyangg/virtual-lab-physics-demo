// engine/widgets/ruler.js
// Виджет «Задание 1»: линейка на столе + перетаскиваемые предметы.
// Ученик берёт предмет мышью/пальцем и прикладывает его к линейке —
// показание считывается из фактического положения краёв предмета
// относительно делений шкалы, а не подставляется готовым числом.

(function () {

  const PX_PER_CM = 34;

  // Рисует одну линейку (дерево + шкала) в указанном месте сцены.
  // Возвращает { container, xOfCm(valueCm), yTop } — xOfCm переводит
  // положение в сантиметрах вдоль линейки в локальную X-координату,
  // нужно для проверки «на что показывает край предмета».
  function buildRuler(ruler, x, y) {
    const lengthPx = ruler.lengthCm * PX_PER_CM;
    const thickness = 34;

    const container = new PIXI.Container();
    container.position.set(x, y);

    const body = LabDraw.drawWoodRuler(lengthPx, thickness);
    const scale = LabDraw.drawScale({
      lengthPx,
      minVal: 0,
      maxVal: ruler.lengthCm,
      divisionVal: ruler.divisionCm,
      orientation: 'horizontal',
      majorEvery: Math.round(1 / ruler.divisionCm) || 1,
      color: 0x3d2b6e,
      fontSize: 10,
    });
    scale.position.set(0, 2);

    const label = new PIXI.Text({
      text: ruler.label,
      style: { fontFamily: 'Segoe UI, Arial, sans-serif', fontSize: 12, fontWeight: '700', fill: 0x5a3a15 },
    });
    label.position.set(lengthPx + 8, thickness / 2 - 8);

    container.addChild(body, scale, label);

    return {
      container,
      xOfCm(valueCm) { return (valueCm / ruler.lengthCm) * lengthPx; },
      cmOfX(px) { return (px / lengthPx) * ruler.lengthCm; },
      lengthPx,
      thickness,
    };
  }

  // Рисует перетаскиваемый предмет (обобщённая «палочка» — годится для
  // карандаша, ластика, скрепки, ключа на данном уровне детализации).
  function buildMeasurableObject(obj, colorSeed) {
    const lengthPx = obj.trueLength * PX_PER_CM;
    const thickness = 12 + (colorSeed % 3) * 3;

    const container = new PIXI.Container();
    const shadow = LabDraw.dropShadow(lengthPx, thickness, 0.3);
    shadow.position.set(lengthPx / 2, thickness + 4);

    const body = LabDraw.drawMeasuredObject(obj.name, lengthPx, thickness);

    const nameLabel = new PIXI.Text({
      text: obj.name,
      style: { fontFamily: 'Segoe UI, Arial, sans-serif', fontSize: 10, fill: 0x333333 },
    });
    nameLabel.position.set(0, thickness + 6);

    container.addChild(shadow, body, nameLabel);
    container._labShadow = shadow;
    container.pivot.set(0, thickness / 2);
    container._labLengthPx = lengthPx;
    return container;
  }

  // Подключает задание 1 к сцене.
  // lab: полная JSON-схема лабы.
  // scene: результат LabScene.createScene(...).
  // rng: детерминированный ГПСЧ для начального разброса позиций.
  // onMeasured(rulerId, objIndex, measuredCm): колбэк — вызывается при
  //   каждом изменении положения предмета относительно линейки (в т.ч.
  //   при отпускании), для заполнения таблиц 1.1/1.2.
  function attachRulerTask(lab, scene, rng, onMeasured) {
    const { app, layers, width } = scene;
    const rulerBuilds = [];

    // Две линейки — одна над другой в верхней части стола.
    lab.rulers.forEach((ruler, i) => {
      const y = 20 + i * 90;
      const built = buildRuler(ruler, 24, y);
      layers.tools.addChild(built.container);
      rulerBuilds.push(built);
    });

    // Предметы раскладываются в нижней части стола, в случайном (но
    // детерминированном по seed) порядке, чтобы каждый вариант выглядел
    // немного иначе.
    const objRow = rulerBuilds.length * 90 + 30;
    const rowHeight = 60;
    lab.objects.forEach((obj, i) => {
      const objContainer = buildMeasurableObject(obj, i);
      // Разброс стартовой позиции ограничен так, чтобы предмет целиком
      // помещался в видимую область сцены независимо от его длины —
      // иначе длинные предметы (например, карандаш 17 см при 34px/см)
      // могли вылезать за правый край.
      const maxStartX = Math.max(24, width - objContainer._labLengthPx - 24);
      const startX = 24 + rng() * Math.max(0, maxStartX - 24);
      const startY = objRow + (i % 2) * rowHeight;
      objContainer.position.set(startX, startY);
      layers.objects.addChild(objContainer);

      function evaluateAgainstAllRulers() {
        rulerBuilds.forEach((rb, rIdx) => {
          const ruler = lab.rulers[rIdx];
          const local = rb.container.toLocal(objContainer.getGlobalPosition());
          const withinBand = local.y > -20 && local.y < rb.thickness + 20;
          if (!withinBand) return;

          // Положение левого и правого края предмета в см вдоль линейки —
          // округляется до цены деления линейки: это и есть физическое
          // ограничение точности прибора, которое нельзя обойти.
          const leftCm = clamp(rb.cmOfX(local.x), 0, ruler.lengthCm);
          const rightCm = clamp(rb.cmOfX(local.x + objContainer._labLengthPx), 0, ruler.lengthCm);
          const roundedLeft = roundToDivision(leftCm, ruler.divisionCm);
          const roundedRight = roundToDivision(rightCm, ruler.divisionCm);
          const measured = Math.max(0, roundedRight - roundedLeft);

          onMeasured(ruler.id, i, measured, { leftCm: roundedLeft, rightCm: roundedRight });
        });
      }

      LabScene.makeDraggable(app, objContainer, {
        onDragEnd: evaluateAgainstAllRulers,
      });
    });
  }

  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
  function roundToDivision(value, division) {
    return Math.round(value / division) * division;
  }

  window.LabRulerWidget = { attachRulerTask };

})();
