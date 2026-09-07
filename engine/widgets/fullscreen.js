// engine/widgets/fullscreen.js
// Кнопка «На весь экран» для сцены лабораторного стола. Не пересоздаёт
// сцену и не трогает ни один объект на ней — просто временно растягивает
// canvas на весь экран (CSS-оверлей + scene.setViewportSize из scene.js,
// который делает renderer.resize + stage.scale). Поэтому положение
// предметов, уровень воды, состояние лупы переживают вход и выход из
// полноэкранного режима без изменений — это те же самые Pixi-объекты.

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
      scene.setViewportSize(window.innerWidth - 32, window.innerHeight - 32);
    }

    function expand() {
      expanded = true;
      wrapEl.classList.add('scene-fullscreen');
      wrapEl.appendChild(exitBtn);
      applySize();
      document.addEventListener('keydown', onKeydown);
      window.addEventListener('resize', applySize);
    }

    function collapse() {
      expanded = false;
      wrapEl.classList.remove('scene-fullscreen');
      if (exitBtn.parentNode) exitBtn.parentNode.removeChild(exitBtn);
      scene.resetViewportSize();
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
