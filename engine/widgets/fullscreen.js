// engine/widgets/fullscreen.js
// Кнопка «На весь экран» для сцены лабораторного стола. Не пересоздаёт
// сцену и не трогает ни один объект на ней — просто временно увеличивает
// canvas под размер экрана (CSS-оверлей + scene.setViewportSize из
// scene.js, который делает renderer.resize + ЕДИНЫЙ stage.scale — без
// искажения пропорций объектов и без overflow ни по одной оси: стол
// вписывается в экран целиком, максимально крупно). Положение предметов,
// уровень воды, состояние лупы переживают вход и выход из полноэкранного
// режима без изменений — это те же самые Pixi-объекты, просто иначе
// увеличенные.

(function () {

  // scene: результат LabScene.createScene(...)
  // wrapEl: DOM-элемент .scene-wrap, который растягивается на весь экран
  // btnEl: кнопка-переключатель под сценой (прячется в полноэкранном режиме —
  //   в position:fixed раскладке она осталась бы в потоке документа под
  //   canvas, поэтому пока стол развёрнут, показывается плавающая кнопка
  //   «Свернуть» прямо внутри wrapEl, поверх canvas).
  function attachFullscreenToggle(scene, wrapEl, btnEl) {
    let expanded = false;

    const exitBtn = document.createElement('button');
    exitBtn.type = 'button';
    exitBtn.className = 'scene-fullscreen-exit no-print';
    exitBtn.textContent = '✕ Свернуть (Esc)';
    exitBtn.addEventListener('click', collapse);

    function applySize() {
      if (!expanded) return;
      scene.setViewportSize(window.innerWidth, window.innerHeight);
    }

    function expand() {
      expanded = true;
      wrapEl.classList.add('scene-fullscreen');
      wrapEl.appendChild(exitBtn);
      applySize();
      // Оверлей закрывает экран визуально (position:fixed), но страница под
      // ним остаётся прокручиваемой — колесо мыши или свайп уводили бы стол
      // в сторону от того, что показано. Блокируем скролл документа на
      // время полноэкранного режима (и html, и body — прокрутка страницы
      // идёт по html, одного body недостаточно), а не только рисуем поверх.
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
      document.addEventListener('keydown', onKeydown);
      window.addEventListener('resize', applySize);
    }

    function collapse() {
      expanded = false;
      wrapEl.classList.remove('scene-fullscreen');
      if (exitBtn.parentNode) exitBtn.parentNode.removeChild(exitBtn);
      scene.resetViewportSize();
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKeydown);
      window.removeEventListener('resize', applySize);
    }

    function onKeydown(e) {
      if (e.key === 'Escape') collapse();
    }

    btnEl.textContent = '⛶ На весь экран';
    btnEl.addEventListener('click', () => { expanded ? collapse() : expand(); });

    return {
      collapse,
      isExpanded() { return expanded; },
    };
  }

  window.LabFullscreenWidget = { attachFullscreenToggle };

})();
