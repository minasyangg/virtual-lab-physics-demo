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

  // ---- Стеклянный сосуд ----------------------------------------------------
  // Рисует только стенки/дно сосуда (без воды — вода рисуется отдельно
  // функцией drawWater, чтобы её можно было анимировать независимо).
  // shape: 'cylinder' | 'flask' | 'tube'
  function drawGlass(width, height, shape) {
    shape = shape || 'cylinder';
    const c = new PIXI.Container();
    const g = new PIXI.Graphics();
    const w = width, h = height;

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
  // Возвращает контейнер; свойство .setLevel(frac) позволяет анимировать
  // изменение уровня без пересоздания объекта.
  function drawWater(width, height, levelFrac, shape) {
    shape = shape || 'cylinder';
    const c = new PIXI.Container();
    const g = new PIXI.Graphics();
    c.addChild(g);

    function render(frac) {
      g.clear();
      frac = Math.max(0, Math.min(1, frac));
      const w = width, h = height;
      const waterH = h * frac;
      const top = h - waterH;
      const meniscusDepth = Math.min(6, w * 0.05); // прогиб мениска у центра

      if (waterH <= 0.5) return;

      // тело воды: прямоугольник (с учётом сужения пробирки понизу не паримся —
      // на масштабе одного деления это визуально несущественно)
      g.moveTo(0, h);
      g.lineTo(0, top + meniscusDepth);
      // вогнутая кривая мениска: ниже у стенок, чуть выше (заметнее) в центре —
      // именно так выглядит смачивающая стекло жидкость снизу вверх при взгляде
      g.quadraticCurveTo(w / 2, top - meniscusDepth * 0.6, w, top + meniscusDepth);
      g.lineTo(w, h);
      g.closePath();
      g.fill({ color: 0x6fb3e0, alpha: 0.55 });

      // тонкая более светлая линия по кромке мениска — ориентир для считывания
      g.moveTo(0, top + meniscusDepth);
      g.quadraticCurveTo(w / 2, top - meniscusDepth * 0.6, w, top + meniscusDepth);
      g.stroke({ width: 1.5, color: 0x2a6fa0, alpha: 0.9 });
    }

    render(levelFrac);
    c.setLevel = render;
    return c;
  }

  // ---- Шкала с делениями (общая для линейки и мензурки) --------------------
  // orientation: 'horizontal' | 'vertical'
  // params: { lengthPx, minVal, maxVal, divisionVal, majorEvery }
  function drawScale(params) {
    const {
      lengthPx, minVal, maxVal, divisionVal,
      orientation = 'horizontal',
      majorEvery = 5,
      color = 0x3d2b6e,
      fontSize = 10,
    } = params;

    const c = new PIXI.Container();
    const g = new PIXI.Graphics();
    const numDivs = Math.round((maxVal - minVal) / divisionVal);
    const pxPerDiv = lengthPx / numDivs;

    for (let i = 0; i <= numDivs; i++) {
      const val = minVal + i * divisionVal;
      const isMajor = Math.round(val / divisionVal) % majorEvery === 0;
      const tickLen = isMajor ? 14 : 8;
      const pos = i * pxPerDiv;

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

  window.LabDraw = {
    dropShadow,
    drawWoodRuler,
    drawMetalBar,
    drawMeasuredObject,
    drawGlass,
    drawWater,
    drawScale,
  };

})();
