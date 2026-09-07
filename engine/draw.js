// engine/draw.js
// Библиотека переиспользуемых примитивов отрисовки для Pixi-сцены
// «лабораторный стол». Каждая функция возвращает PIXI.Container
// с готовой к использованию графикой (0,0 — точка привязки объекта).
//
// Ничего здесь не знает о конкретной лабе — только про то, как
// нарисовать стекло, воду, дерево, металл, тень и шкалу.

(function () {

  // ---- Тень под предметом -------------------------------------------------
  // Рисуется отдельным слоем под самим предметом. intensity 0..1 управляет
  // прозрачностью и размытием — усиливается, когда предмет «поднят» в руке.
  function dropShadow(width, height, intensity) {
    intensity = intensity === undefined ? 0.35 : intensity;
    const g = new PIXI.Graphics();
    const rx = width / 2 + 4 * intensity;
    const ry = Math.max(6, height * 0.18) + 2 * intensity;
    g.ellipse(0, 0, rx, ry);
    g.fill({ color: 0x1a1030, alpha: 0.22 * intensity + 0.08 });
    g.filters = [];
    return g;
  }

  // ---- Дерево (линейка) ---------------------------------------------------
  function drawWoodRuler(lengthPx, thicknessPx) {
    const c = new PIXI.Container();
    const g = new PIXI.Graphics();
    const w = lengthPx, h = thicknessPx;

    // Корпус линейки — тёплый деревянный градиент через несколько полос
    g.roundRect(0, 0, w, h, 3);
    g.fill(0xdcb787);
    // более светлая полоса сверху (имитация блика на дереве)
    g.roundRect(2, 2, w - 4, h * 0.35, 2);
    g.fill({ color: 0xf0d4a6, alpha: 0.6 });
    // нижняя тень корпуса
    g.roundRect(2, h * 0.72, w - 4, h * 0.24, 2);
    g.fill({ color: 0xa9793f, alpha: 0.35 });
    // контур
    g.roundRect(0, 0, w, h, 3);
    g.stroke({ width: 1.5, color: 0x8a5a2b, alpha: 0.8 });

    c.addChild(g);
    return c;
  }

  // ---- Металл (скрепка, ключ и т.п. — простые предметы) --------------------
  function drawMetalBar(lengthPx, thicknessPx) {
    const c = new PIXI.Container();
    const g = new PIXI.Graphics();
    const w = lengthPx, h = Math.max(6, thicknessPx);

    g.roundRect(0, 0, w, h, h / 2);
    g.fill(0x9aa3ad);
    g.roundRect(0, 0, w, h * 0.4, h / 2);
    g.fill({ color: 0xe7ebef, alpha: 0.55 });
    g.roundRect(0, 0, w, h, h / 2);
    g.stroke({ width: 1, color: 0x5b636b, alpha: 0.7 });

    c.addChild(g);
    return c;
  }

  // ---- Узнаваемые предметы для задания «линейка» ---------------------------
  // Простая эвристика по названию предмета из JSON лабы — рисует характерный
  // силуэт, чтобы карандаш, ластик, скрепка и ключ не выглядели одинаковыми
  // серыми брусками на столе. Незнакомое название падает на общий вариант.
  function drawMeasuredObject(name, lengthPx, thicknessPx) {
    const lower = (name || '').toLowerCase();
    const c = new PIXI.Container();
    const g = new PIXI.Graphics();
    const w = lengthPx, h = thicknessPx;

    if (lower.includes('карандаш')) {
      // деревянный шестигранный корпус + графитовый кончик + грифель
      const tipW = Math.min(24, w * 0.12);
      g.rect(tipW, 0, w - tipW, h);
      g.fill(0xf0b429);
      g.rect(tipW, h * 0.15, w - tipW, h * 0.2);
      g.fill({ color: 0xffe6a0, alpha: 0.6 });
      g.moveTo(0, h / 2);
      g.lineTo(tipW, 0);
      g.lineTo(tipW, h);
      g.closePath();
      g.fill(0xd9a441);
      g.circle(2, h / 2, 1.6);
      g.fill(0x2a2a2a);
      g.rect(tipW, 0, w - tipW, h);
      g.stroke({ width: 1, color: 0xa87a1f, alpha: 0.7 });
    } else if (lower.includes('ласт')) {
      // прямоугольный ластик со скошенным более светлым торцом
      g.roundRect(0, 0, w, h, 2);
      g.fill(0xe86a92);
      g.roundRect(0, 0, w * 0.18, h, 2);
      g.fill({ color: 0xffc3d6, alpha: 0.7 });
      g.roundRect(0, 0, w, h, 2);
      g.stroke({ width: 1, color: 0xb14a6c, alpha: 0.8 });
    } else if (lower.includes('скреп')) {
      // тонкая проволочная петля вместо сплошного бруска
      const r = h * 0.42;
      g.roundRect(0, h / 2 - r, w, r * 2, r);
      g.stroke({ width: 2.5, color: 0x8892a0, alpha: 0.95 });
      g.roundRect(w * 0.12, h / 2 - r * 0.55, w * 0.76, r * 1.1, r * 0.55);
      g.stroke({ width: 2.5, color: 0x8892a0, alpha: 0.95 });
    } else if (lower.includes('ключ')) {
      // стержень ключа + прямоугольная головка (ушко) слева + бородка справа
      const headR = h * 0.9;
      g.circle(headR, h / 2, headR);
      g.fill(0xb8bfc7);
      g.circle(headR, h / 2, headR * 0.45);
      g.fill(0xece6da); // сквозное отверстие ушка
      g.rect(headR * 1.6, h * 0.32, w - headR * 1.6 - 10, h * 0.36);
      g.fill(0xb8bfc7);
      g.rect(w - 14, h * 0.1, 10, h * 0.3);
      g.fill(0xb8bfc7);
      g.rect(w - 14, h * 0.6, 10, h * 0.3);
      g.fill(0xb8bfc7);
      g.circle(headR, h / 2, headR);
      g.stroke({ width: 1, color: 0x7a838d, alpha: 0.8 });
    } else {
      // резервный вариант — нейтральный металлический брусок
      g.roundRect(0, 0, w, h, h / 2);
      g.fill(0x9aa3ad);
      g.roundRect(0, 0, w, h * 0.4, h / 2);
      g.fill({ color: 0xe7ebef, alpha: 0.55 });
      g.roundRect(0, 0, w, h, h / 2);
      g.stroke({ width: 1, color: 0x5b636b, alpha: 0.7 });
    }

    c.addChild(g);
    return c;
  }

  // ---- Контур сосуда --------------------------------------------------------
  // Строит путь контура на переданном PIXI.Graphics — переиспользуется и для
  // видимого стекла (drawGlass), и для маски воды (drawWater), чтобы жидкость
  // никогда не могла нарисоваться за пределами непрямоугольных стенок сосуда
  // (сужение горлышка колбы, закруглённое дно пробирки).
  function traceVesselOutline(g, w, h, shape) {
    if (shape === 'flask') {
      // колба: узкое горлышко + расширяющаяся коническая часть
      const neckW = w * 0.28, neckH = h * 0.22;
      g.moveTo(w / 2 - neckW / 2, 0);
      g.lineTo(w / 2 + neckW / 2, 0);
      g.lineTo(w / 2 + neckW / 2, neckH);
      g.lineTo(w, h - h * 0.06);
      g.quadraticCurveTo(w, h, w * 0.85, h);
      g.lineTo(w * 0.15, h);
      g.quadraticCurveTo(0, h, 0, h - h * 0.06);
      g.lineTo(w / 2 - neckW / 2, neckH);
      g.closePath();
    } else if (shape === 'tube') {
      // пробирка: узкий цилиндр с закруглённым дном
      g.moveTo(0, 0);
      g.lineTo(w, 0);
      g.lineTo(w, h - w / 2);
      g.arc(w / 2, h - w / 2, w / 2, 0, Math.PI, false);
      g.closePath();
    } else {
      // мензурка: прямой цилиндр с чуть расширенным носиком сверху
      g.moveTo(0, h * 0.03);
      g.lineTo(0, h);
      g.lineTo(w, h);
      g.lineTo(w, h * 0.03);
      g.closePath();
    }
  }

  // ---- Стеклянный сосуд ----------------------------------------------------
  // Рисует только стенки/дно сосуда (без воды — вода рисуется отдельно
  // функцией drawWater, чтобы её можно было анимировать независимо).
  // shape: 'cylinder' | 'flask' | 'tube'
  function drawGlass(width, height, shape) {
    shape = shape || 'cylinder';
    const c = new PIXI.Container();
    const g = new PIXI.Graphics();
    const w = width, h = height;

    traceVesselOutline(g, w, h, shape);
    g.fill({ color: 0xdfeaf2, alpha: 0.22 });
    g.stroke({ width: 2, color: 0x9db3c2, alpha: 0.85 });

    // вертикальный блик слева — характерный «стеклянный» акцент
    const hi = new PIXI.Graphics();
    hi.roundRect(w * 0.12, h * 0.08, w * 0.08, h * 0.8, 4);
    hi.fill({ color: 0xffffff, alpha: 0.35 });

    c.addChild(g, hi);
    c._labGlassW = w;
    c._labGlassH = h;
    c._labShape = shape;
    return c;
  }

  // ---- Вода с изогнутым мениском -------------------------------------------
  // levelFrac: 0 (пусто) .. 1 (полный сосуд), считая от дна.
  // viewAngle: -1 (смотрим сверху вниз) .. 0 (взгляд на уровне мениска,
  //   верно) .. 1 (смотрим снизу вверх) — управляет кажущимся искажением
  //   формы поверхности воды из-за параллакса, не меняя истинный levelFrac.
  // Возвращает контейнер; свойства .setLevel(frac) и .setViewAngle(angle)
  // позволяют анимировать оба параметра без пересоздания объекта. Форма
  // воды всегда обрезается маской по контуру сосуда (traceVesselOutline),
  // поэтому не может нарисоваться за пределами стенок — важно для узкого
  // горлышка колбы и скруглённого дна пробирки.
  function drawWater(width, height, levelFrac, shape) {
    shape = shape || 'cylinder';
    const c = new PIXI.Container();
    const g = new PIXI.Graphics();
    c.addChild(g);

    const mask = new PIXI.Graphics();
    traceVesselOutline(mask, width, height, shape);
    mask.fill(0xffffff);
    c.addChild(mask);
    c.mask = mask;

    let currentAngle = 0;
    let currentFrac = levelFrac;

    function render(frac, viewAngle) {
      if (frac === undefined) frac = currentFrac;
      if (viewAngle === undefined) viewAngle = currentAngle;
      currentFrac = frac;
      currentAngle = viewAngle;
      g.clear();
      frac = Math.max(0, Math.min(1, frac));
      const w = width, h = height;
      const waterH = h * frac;
      const top = h - waterH;
      // Прогиб истинного мениска: вода смачивает стекло, поэтому у стенок
      // сосуда поверхность подтягивается ВВЕРХ (меньший Y), а в центре
      // остаётся ниже (больший Y) — вогнутая «ложка». Читать положено по
      // нижней точке в центре, а не по краям, которые кажутся выше.
      const meniscusDepth = Math.min(6, w * 0.05);
      // Параллакс сдвигает ВСЮ видимую линию (включая края у шкалы, где
      // и происходит считывание) — не только центр сосуда. Именно край,
      // ближний к шкале, и определяет «показание», которое видит ученик,
      // поэтому эффект должен быть заметен там, а не спрятан в середине.
      // Смотрим сверху (viewAngle<0) — видимая линия «приподнимается»
      // (кажется, что уровень выше истинного); снизу — «опускается».
      const parallaxShift = viewAngle * Math.min(24, h * 0.12);
      const edgeY = top - meniscusDepth + parallaxShift;
      const centerY = top + meniscusDepth * 0.6 + parallaxShift * 1.4;

      if (waterH <= 0.5) return;

      // тело воды — по прямоугольнику, реальный контур сосуда обрежет
      // маска, так что сужение горлышка/скруглённое дно всегда соблюдены
      g.moveTo(0, h);
      g.lineTo(0, edgeY);
      g.quadraticCurveTo(w / 2, centerY, w, edgeY);
      g.lineTo(w, h);
      g.closePath();
      g.fill({ color: 0x6fb3e0, alpha: 0.55 });

      // тонкая более светлая линия по кромке кажущейся поверхности —
      // ориентир для считывания (то, что реально видит ученик)
      g.moveTo(0, edgeY);
      g.quadraticCurveTo(w / 2, centerY, w, edgeY);
      g.stroke({ width: 1.5, color: 0x2a6fa0, alpha: 0.9 });
    }

    render(levelFrac, 0);
    c.setLevel = (frac) => render(frac, undefined);
    c.setViewAngle = (angle) => render(undefined, angle);
    return c;
  }

  // ---- Шкала с делениями (общая для линейки и мензурки) --------------------
  // orientation: 'horizontal' | 'vertical'
  // params: { lengthPx, minVal, maxVal, divisionVal, majorEvery, flip }
  // flip: true разворачивает направление отсчёта (для вертикальной шкалы —
  //   максимум сверху, как на мензурке) БЕЗ переворота самого контейнера —
  //   иначе текстовые подписи делений отражались бы вверх ногами.
  function drawScale(params) {
    const {
      lengthPx, minVal, maxVal, divisionVal,
      orientation = 'horizontal',
      majorEvery = 5,
      color = 0x3d2b6e,
      fontSize = 10,
      flip = false,
    } = params;

    const c = new PIXI.Container();
    const g = new PIXI.Graphics();
    const numDivs = Math.round((maxVal - minVal) / divisionVal);
    const pxPerDiv = lengthPx / numDivs;

    for (let i = 0; i <= numDivs; i++) {
      const val = minVal + i * divisionVal;
      const isMajor = Math.round(val / divisionVal) % majorEvery === 0;
      const tickLen = isMajor ? 14 : 8;
      const pos = flip ? lengthPx - i * pxPerDiv : i * pxPerDiv;

      if (orientation === 'horizontal') {
        g.moveTo(pos, 0);
        g.lineTo(pos, tickLen);
      } else {
        g.moveTo(0, pos);
        g.lineTo(tickLen, pos);
      }
      g.stroke({ width: isMajor ? 1.4 : 1, color, alpha: isMajor ? 0.9 : 0.6 });

      if (isMajor) {
        const label = new PIXI.Text({
          text: roundLabel(val),
          style: { fontFamily: 'Segoe UI, Arial, sans-serif', fontSize, fill: color },
        });
        label.anchor.set(orientation === 'horizontal' ? 0.5 : 0, 0.5);
        if (orientation === 'horizontal') {
          label.position.set(pos, -fontSize * 0.9);
        } else {
          label.position.set(tickLen + 4, pos);
        }
        c.addChild(label);
      }
    }

    c.addChildAt(g, 0);
    c._labPxPerUnit = lengthPx / (maxVal - minVal);
    return c;
  }

  function roundLabel(v) {
    // избегаем «0.30000000004» из-за плавающей точки в подписях шкалы
    const r = Math.round(v * 1000) / 1000;
    return String(r);
  }

  // ---- Малые твёрдые тела для задания «объём тела погружением» -------------
  // Тела неправильной формы, которые нельзя измерить линейкой — в этом и
  // физический смысл всей работы. shape: 'nut' | 'bolt' | 'ball'.
  // size — примерный диаметр/размах в пикселях.
  function drawSolidBody(shape, size) {
    const c = new PIXI.Container();
    const g = new PIXI.Graphics();
    const s = size;

    if (shape === 'nut') {
      // шестигранная гайка с отверстием
      const r = s / 2;
      const pts = [];
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i - Math.PI / 2;
        pts.push(r + r * Math.cos(a), r + r * Math.sin(a));
      }
      g.poly(pts);
      g.fill(0x8a8f96);
      g.poly(pts);
      g.stroke({ width: 1, color: 0x5b6169, alpha: 0.9 });
      g.circle(r, r, r * 0.42);
      g.fill(0xece6da); // сквозное отверстие — цвет столешницы
      g.circle(r, r, r * 0.42);
      g.stroke({ width: 1, color: 0x5b6169, alpha: 0.7 });
      // блик
      g.poly([r * 0.35, r * 0.3, r * 0.75, r * 0.3, r * 0.6, r * 0.55, r * 0.35, r * 0.55]);
      g.fill({ color: 0xffffff, alpha: 0.18 });
    } else if (shape === 'bolt') {
      // шестигранная головка + резьбовой стержень
      const headR = s * 0.32, shaftW = s * 0.22, shaftH = s * 0.62;
      const pts = [];
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i - Math.PI / 2;
        pts.push(headR + headR * Math.cos(a), headR + headR * Math.sin(a));
      }
      g.poly(pts);
      g.fill(0x9aa3ad);
      g.poly(pts);
      g.stroke({ width: 1, color: 0x5b636b, alpha: 0.9 });
      g.rect(headR - shaftW / 2, headR * 1.7, shaftW, shaftH);
      g.fill(0xb0b8c0);
      // витки резьбы — тонкие горизонтальные штрихи
      for (let i = 0; i < 5; i++) {
        const y = headR * 1.9 + i * (shaftH / 5.5);
        g.moveTo(headR - shaftW / 2, y);
        g.lineTo(headR + shaftW / 2, y);
        g.stroke({ width: 1, color: 0x7a838d, alpha: 0.6 });
      }
      g.rect(headR - shaftW / 2, headR * 1.7, shaftW, shaftH);
      g.stroke({ width: 1, color: 0x5b636b, alpha: 0.8 });
    } else {
      // шарик — гладкая сфера с бликом
      const r = s / 2;
      g.circle(r, r, r);
      g.fill(0x8a92a0);
      g.circle(r * 0.65, r * 0.65, r * 0.32);
      g.fill({ color: 0xffffff, alpha: 0.45 });
      g.circle(r, r, r);
      g.stroke({ width: 1, color: 0x5b636b, alpha: 0.85 });
    }

    c.addChild(g);
    c._labBodySize = s;
    return c;
  }

  // ---- Отливной сосуд -------------------------------------------------------
  // Сосуд, наполненный водой ровно до отверстия боковой трубки: любое тело,
  // погружённое в него, вытесняет через трубку объём воды, равный своему
  // объёму. Рисуется отдельно от мензурки, потому что имеет боковой носик.
  // Возвращает { container, spoutTipLocal } — spoutTipLocal нужен, чтобы
  // нарисовать анимацию струйки воды, льющейся именно из носика.
  function drawSpoutVessel(width, height) {
    const c = new PIXI.Container();
    const w = width, h = height;
    const spoutY = h * 0.22; // уровень трубки — досюда сосуд налит по условию опыта

    const body = new PIXI.Graphics();
    body.moveTo(0, spoutY * 0.4);
    body.lineTo(0, h);
    body.lineTo(w, h);
    body.lineTo(w, spoutY * 0.4);
    body.closePath();
    body.fill({ color: 0xdfeaf2, alpha: 0.22 });
    body.stroke({ width: 2, color: 0x9db3c2, alpha: 0.85 });

    // боковая трубка-носик, через которую льётся излишек воды
    const spout = new PIXI.Graphics();
    const spoutLen = w * 0.4;
    spout.moveTo(w, spoutY - 3);
    spout.lineTo(w + spoutLen, spoutY - 5);
    spout.lineTo(w + spoutLen, spoutY + 5);
    spout.lineTo(w, spoutY + 3);
    spout.closePath();
    spout.fill({ color: 0xdfeaf2, alpha: 0.3 });
    spout.stroke({ width: 1.5, color: 0x9db3c2, alpha: 0.85 });

    // вода стоит ровно до уровня трубки — это неизменное условие опыта,
    // поэтому здесь просто заливка, а не drawWater с изменяемым уровнем
    const water = new PIXI.Graphics();
    water.moveTo(0, spoutY);
    water.lineTo(0, h);
    water.lineTo(w, h);
    water.lineTo(w, spoutY);
    water.closePath();
    water.fill({ color: 0x8fb8d6, alpha: 0.55 });

    const hi = new PIXI.Graphics();
    hi.roundRect(w * 0.12, spoutY + h * 0.05, w * 0.08, h * 0.7, 4);
    hi.fill({ color: 0xffffff, alpha: 0.3 });

    c.addChild(water, body, hi, spout);
    c._labSpoutTip = { x: w + spoutLen, y: spoutY };
    c._labSpoutY = spoutY;
    return c;
  }

  window.LabDraw = {
    dropShadow,
    drawWoodRuler,
    drawMetalBar,
    drawMeasuredObject,
    drawGlass,
    drawWater,
    drawScale,
    drawSolidBody,
    drawSpoutVessel,
  };

})();
