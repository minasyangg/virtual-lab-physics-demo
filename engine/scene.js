// engine/scene.js
// Ядро Pixi-сцены «лабораторный стол»: инициализация Application,
// слои и общая drag-система, одинаковая для любого перетаскиваемого
// предмета (линейка, объект измерения, сосуд с водой).

(function () {

  // ---- Создание сцены -------------------------------------------------
  // containerEl: DOM-элемент, в который вставляется canvas.
  // Возвращает { app, layers } — app.stage уже содержит слои по порядку
  // (стол → приборы → перетаскиваемые предметы → интерфейс).
  async function createScene(containerEl, opts) {
    opts = opts || {};
    const width = containerEl.clientWidth || 900;
    const height = opts.height || 420;

    const app = new PIXI.Application();
    await app.init({
      width, height,
      backgroundAlpha: 0,
      antialias: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
    });
    containerEl.appendChild(app.canvas);

    // фон-столешница: тёплый нейтральный градиент, чтобы приборы читались
    const table = new PIXI.Graphics();
    table.rect(0, 0, width, height);
    table.fill(0xece6da);
    table.rect(0, 0, width, height);
    table.stroke({ width: 1, color: 0xd8cfba, alpha: 0.6 });

    const layerTable = new PIXI.Container();
    const layerTools = new PIXI.Container();
    const layerObjects = new PIXI.Container();
    const layerUI = new PIXI.Container();
    layerTable.addChild(table);

    app.stage.addChild(layerTable, layerTools, layerObjects, layerUI);
    app.stage.eventMode = 'static';
    app.stage.hitArea = new PIXI.Rectangle(0, 0, width, height);

    const scene = {
      app, width, height,
      layers: { table: layerTable, tools: layerTools, objects: layerObjects, ui: layerUI },
    };

    // --- Поддержка «второго взгляда» на сцену (лупа) ---------------------
    // Лупа не может переиспользовать объекты стола: Pixi привязывает
    // GPU-ресурсы объекта к тому рендереру, который его нарисовал, и во
    // втором рендерере такой объект не рисуется. Поэтому сцена должна
    // уметь построить свою независимую копию — этим занимается функция,
    // переданная в setRebuilder(): она рисует то же содержимое заново,
    // из текущего состояния, но новыми объектами.
    let rebuilder = null;
    const changeListeners = [];

    scene.setRebuilder = function (fn) { rebuilder = fn; };
    scene.rebuild = function () {
      if (!rebuilder) return null;
      const copy = new PIXI.Container();
      // столешница в копии — тем же цветом, что и на основной сцене
      const bg = new PIXI.Graphics();
      bg.rect(0, 0, width, height);
      bg.fill(0xece6da);
      copy.addChild(bg);
      rebuilder(copy);
      return copy;
    };
    // Виджеты зовут это при любом изменении на столе (перелили воду,
    // подвинули предмет), чтобы картинка под лупой не отставала.
    scene.onChange = function (fn) { changeListeners.push(fn); };
    scene.notifyChanged = function () {
      changeListeners.forEach((fn) => fn());
    };

    return scene;
  }

  // ---- Общая drag-система -----------------------------------------------
  // Делает контейнер `target` перетаскиваемым внутри `app`.
  // callbacks (все опциональны):
  //   onDragStart(target)
  //   onDragMove(target)   — вызывается на каждое перемещение
  //   onDragEnd(target)
  // Во время перетаскивания предмет визуально «приподнимается»: лёгкое
  // увеличение масштаба + усиленная тень (если у target есть свойство
  // ._labShadow — PIXI.Graphics тени, привязанной к тому же родителю).
  function makeDraggable(app, target, callbacks) {
    callbacks = callbacks || {};
    target.eventMode = 'static';
    target.cursor = 'grab';

    let dragging = false;
    let start = { x: 0, y: 0 };
    let origin = { x: 0, y: 0 };
    const baseScale = target.scale.x || 1;

    function toLocalParent(globalPoint) {
      return target.parent.toLocal(globalPoint);
    }

    target.on('pointerdown', (e) => {
      dragging = true;
      target.cursor = 'grabbing';
      const p = toLocalParent(e.global);
      start = { x: p.x, y: p.y };
      origin = { x: target.x, y: target.y };
      target.parent.addChild(target); // поднять поверх остальных объектов слоя
      // Лёгкое увеличение — едва заметное «взял в руку», но не настолько
      // сильное, чтобы сместить видимые края предмета относительно шкалы
      // и мешать точному прицеливанию (это измерительный инструмент, не игра).
      target.scale.set(baseScale * 1.02);
      if (target._labShadow) target._labShadow.alpha = 1.4;
      if (callbacks.onDragStart) callbacks.onDragStart(target);
    });

    app.stage.on('pointermove', (e) => {
      if (!dragging) return;
      const p = toLocalParent(e.global);
      target.x = origin.x + (p.x - start.x);
      target.y = origin.y + (p.y - start.y);
      if (callbacks.onDragMove) callbacks.onDragMove(target);
    });

    function endDrag() {
      if (!dragging) return;
      dragging = false;
      target.cursor = 'grab';
      target.scale.set(baseScale);
      if (target._labShadow) target._labShadow.alpha = 1;
      if (callbacks.onDragEnd) callbacks.onDragEnd(target);
    }
    app.stage.on('pointerup', endDrag);
    app.stage.on('pointerupoutside', endDrag);

    return {
      destroy() {
        target.off('pointerdown');
        app.stage.off('pointermove');
        app.stage.off('pointerup', endDrag);
        app.stage.off('pointerupoutside', endDrag);
      },
    };
  }

  // ---- Плавная анимация уровня воды -------------------------------------
  // Анимирует water.setLevel(frac) от текущего значения к targetFrac за
  // durationMs, используя тикер приложения. Используется для переливания
  // (мензурка/сосуд наполняется или пустеет плавно, а не скачком).
  // onComplete вызывается один раз по завершении.
  function tweenWaterLevel(app, water, fromFrac, targetFrac, durationMs, onComplete) {
    const start = performance.now();
    function step() {
      const t = Math.min(1, (performance.now() - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 2); // ease-out — быстрее в начале, плавно замедляется
      water.setLevel(fromFrac + (targetFrac - fromFrac) * eased);
      if (t < 1) {
        requestAnimationFrame(step);
      } else if (onComplete) {
        onComplete();
      }
    }
    requestAnimationFrame(step);
  }

  window.LabScene = { createScene, makeDraggable, tweenWaterLevel };

})();
