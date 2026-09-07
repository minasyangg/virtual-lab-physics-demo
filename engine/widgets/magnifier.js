// engine/widgets/magnifier.js
// Инструмент «лупа»: круглое увеличительное стекло, которое лежит на
// лабораторном столе и которое можно взять мышью и водить над любым
// местом сцены — над шкалой линейки, над мениском в мензурке.
//
// Как это устроено (и почему именно так).
//
// Очевидный подход — «сфотографировать» уже нарисованную сцену и показать
// кусок снимка крупнее — на практике не работает. Ни через PIXI.RenderTexture,
// ни через drawImage() с WebGL-канваса: содержимое буфера после вывода на
// экран не гарантируется, а объект, однажды отрисованный одним рендерером,
// во втором рендерере не рисуется вовсе — Pixi привязывает GPU-ресурсы
// объекта к конкретному рендереру. Обе попытки давали пустой кружок.
//
// Поэтому лупа ничего не «фотографирует». Она держит СВОЙ маленький
// рендерер и СВОЮ независимую копию сцены, построенную той же функцией,
// что строит оригинал (scene.rebuild). Копия — полноценные объекты Pixi,
// принадлежащие только рендереру лупы, поэтому рисуются всегда. Чтобы под
// стеклом было видно то же, что на столе, копия пересобирается при каждом
// изменении сцены (magnifier.refresh) — это дёшево, кадр перерисовывается
// только когда что-то реально поменялось или когда лупу двигают.

(function () {

  const DEFAULTS = { radius: 52, zoom: 2.6 };

  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

  function attachMagnifier(scene, opts) {
    opts = opts || {};
    if (typeof scene.rebuild !== 'function') {
      // Сцена не умеет пересобирать себя — лупе нечего показывать.
      // Молча ничего не делаем, чтобы не ломать остальную страницу.
      return { refresh() {}, destroy() {} };
    }

    const radius = opts.radius || DEFAULTS.radius;
    const zoom = opts.zoom || DEFAULTS.zoom;
    const { app, layers, width, height } = scene;
    const size = radius * 2;

    // Точка сцены, которую лупа увеличивает (центр стекла). Стартовую
    // позицию прижимаем к границам стола: ширина сцены зависит от ширины
    // страницы, и на узком экране лупа иначе свисала бы за край.
    const margin = radius + 6;
    let lensX = clamp(opts.startX !== undefined ? opts.startX : width - margin, margin, width - margin);
    let lensY = clamp(opts.startY !== undefined ? opts.startY : height - margin, margin, height - margin);

    // --- Корпус лупы на основной сцене ---------------------------------
    const frame = new PIXI.Container();

    // Стекло: сюда попадает картинка с собственного рендерера лупы.
    const glassSprite = new PIXI.Sprite();
    glassSprite.anchor.set(0.5);

    // Круглая маска — увеличенное видно только внутри окружности стекла.
    const glassMask = new PIXI.Graphics();
    glassMask.circle(0, 0, radius - 3);
    glassMask.fill(0xffffff);
    glassSprite.mask = glassMask;

    // Ручка — уходит вправо-вниз, как у настоящей лупы.
    const hx = Math.cos(Math.PI / 4.5), hy = Math.sin(Math.PI / 4.5);
    const handleG = new PIXI.Graphics();
    handleG.moveTo(hx * (radius - 2), hy * (radius - 2));
    handleG.lineTo(hx * (radius + 44), hy * (radius + 44));
    handleG.stroke({ width: 11, color: 0x8b5e34, cap: 'round' });
    handleG.moveTo(hx * (radius + 4), hy * (radius + 4));
    handleG.lineTo(hx * (radius + 38), hy * (radius + 38));
    handleG.stroke({ width: 3, color: 0xa9754a, alpha: 0.8, cap: 'round' });

    // Обод и блик — чтобы читалось как предмет, а не «дырка» в столе.
    const rim = new PIXI.Graphics();
    rim.circle(0, 0, radius - 1);
    rim.stroke({ width: 5, color: 0x6b7280 });
    rim.circle(0, 0, radius - 4.5);
    rim.stroke({ width: 1.5, color: 0xd7dbe0, alpha: 0.9 });

    const glare = new PIXI.Graphics();
    glare.ellipse(-radius * 0.32, -radius * 0.34, radius * 0.3, radius * 0.15);
    glare.fill({ color: 0xffffff, alpha: 0.2 });

    frame.addChild(handleG, glassSprite, glassMask, glare, rim);
    frame.position.set(lensX, lensY);
    frame.eventMode = 'static';
    frame.cursor = 'grab';
    // Схватить можно и за стекло, и за ручку.
    frame.hitArea = new PIXI.Circle(0, 0, radius + 8);
    layers.ui.addChild(frame);

    // --- Собственный рендерер лупы -------------------------------------
    // Только renderer, без Application: у него нет своего тикера и
    // авторендера, который мог бы затереть наш ручной вызов.
    let lensRenderer = null;
    let mirror = null;        // независимая копия сцены — объекты лупы
    let mirrorHolder = null;
    let needsRedraw = true;
    let destroyed = false;

    (async () => {
      lensRenderer = await PIXI.autoDetectRenderer({
        width: size, height: size,
        background: 0xece6da,        // цвет столешницы — под стеклом не пустота
        antialias: true,
        resolution: Math.min(window.devicePixelRatio || 1, 2),
        preserveDrawingBuffer: true, // иначе снятая с канвы текстура пуста
      });
      if (destroyed) { lensRenderer.destroy(); return; }

      mirrorHolder = new PIXI.Container();
      mirrorHolder.scale.set(zoom);

      glassSprite.texture = PIXI.Texture.from(lensRenderer.canvas);
      glassSprite.width = size;
      glassSprite.height = size;

      rebuildMirror();

      // Рендерим из тикера ОСНОВНОГО приложения на приоритете ниже
      // основного рендера (TickerPlugin рисует app.stage на LOW = -25),
      // иначе наш кадр будет затёрт.
      app.ticker.add(onTick, null, PIXI.UPDATE_PRIORITY.UTILITY);
    })();

    function rebuildMirror() {
      if (!lensRenderer || destroyed) return;
      if (mirror) mirror.destroy({ children: true });
      mirror = scene.rebuild();   // независимые объекты, только для лупы
      mirrorHolder.removeChildren();
      mirrorHolder.addChild(mirror);
      needsRedraw = true;
    }

    function onTick() {
      if (!needsRedraw || !lensRenderer || !mirror || destroyed) return;
      // Сдвигаем копию так, чтобы точка (lensX, lensY) сцены оказалась
      // в центре круглого окна, увеличенная в zoom раз.
      mirrorHolder.position.set(radius - lensX * zoom, radius - lensY * zoom);
      lensRenderer.render({ container: mirrorHolder, clear: true });
      glassSprite.texture.source.update(); // забрать свежие пиксели канвы
      needsRedraw = false;
    }

    // --- Перетаскивание -------------------------------------------------
    // Своя реализация, а не LabScene.makeDraggable: у лупы не должно быть
    // эффекта «приподнять и увеличить» при захвате — она сама увеличивает,
    // и её подскок сбивал бы прицел.
    let dragging = false;
    const grab = { dx: 0, dy: 0 };

    frame.on('pointerdown', (e) => {
      dragging = true;
      frame.cursor = 'grabbing';
      const p = frame.parent.toLocal(e.global);
      grab.dx = frame.x - p.x;
      grab.dy = frame.y - p.y;
      frame.parent.addChild(frame); // поверх остальных предметов
    });

    function onMove(e) {
      if (!dragging) return;
      const p = frame.parent.toLocal(e.global);
      lensX = Math.max(0, Math.min(width, p.x + grab.dx));
      lensY = Math.max(0, Math.min(height, p.y + grab.dy));
      frame.position.set(lensX, lensY);
      needsRedraw = true;
    }

    function endDrag() {
      if (!dragging) return;
      dragging = false;
      frame.cursor = 'grab';
    }

    app.stage.on('pointermove', onMove);
    app.stage.on('pointerup', endDrag);
    app.stage.on('pointerupoutside', endDrag);

    return {
      // Вызывается сценой, когда на столе что-то изменилось (перелили воду,
      // подвинули предмет, сменили угол взгляда) — копия под стеклом должна
      // показывать то же, что стол.
      refresh: rebuildMirror,
      // Текущая точка наблюдения — нужна тестам и возможной подсветке.
      getFocus() { return { x: lensX, y: lensY }; },
      destroy() {
        destroyed = true;
        app.ticker.remove(onTick);
        app.stage.off('pointermove', onMove);
        app.stage.off('pointerup', endDrag);
        app.stage.off('pointerupoutside', endDrag);
        if (mirror) mirror.destroy({ children: true });
        if (lensRenderer) lensRenderer.destroy();
        frame.destroy({ children: true });
      },
    };
  }

  window.LabMagnifierWidget = { attachMagnifier };

})();
