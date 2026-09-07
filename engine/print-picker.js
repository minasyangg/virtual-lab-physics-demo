// engine/print-picker.js
// Экран «что включить в печать» перед формированием PDF/печатью рабочего
// листа. Сканирует #app и строит дерево: секция → (таблицы со строками /
// блоки вопросов) — учитель может снять галочку с целой секции, с одной
// таблицы или с отдельной строки/вопроса, если конкретному классу они не
// нужны. Ничего не удаляет из DOM: помечает узлы классом .print-excluded,
// который прячется только в @media print (styles.css), поэтому обычный
// экранный вид и сохранённый прогресс не меняются — исключения касаются
// только текущей печати и в localStorage не сохраняются.
//
// Использование: openPrintPicker(() => window.print()) — колбэк вызывается
// после того, как пользователь нажал «Печать» в диалоге выбора.

(function () {

  function collectSections() {
    const app = document.getElementById('app');
    const sections = [...app.querySelectorAll('.section')];
    return sections.map((section, sIdx) => {
      const heading = section.querySelector('h2, .bar');
      const title = section.dataset.printTitle || (heading ? heading.textContent.trim() : `Раздел ${sIdx + 1}`);
      section.dataset.printId = section.dataset.printId || `s${sIdx}`;

      // Внутри секции — отдельно управляемые элементы: строки таблиц и
      // блоки вопросов (.step). Если их нет, секция управляется целиком.
      const rows = [...section.querySelectorAll('table tbody tr')];
      const steps = [...section.querySelectorAll('.step')];
      rows.forEach((tr, i) => { tr.dataset.printId = tr.dataset.printId || `${section.dataset.printId}-r${i}`; });
      steps.forEach((st, i) => { st.dataset.printId = st.dataset.printId || `${section.dataset.printId}-q${i}`; });

      return { section, title, rows, steps };
    });
  }

  function buildModalHtml(items) {
    return `
      <div class="print-picker-backdrop" id="print-picker-backdrop">
        <div class="print-picker-box">
          <h3>Что включить в печать?</h3>
          <p class="small-note">Снимите галочки с того, что не нужно печатать для этого класса — остальное соберётся в PDF/на печать. Изменения не сохраняются и не влияют на экранный вид.</p>
          <div class="print-picker-list">
            ${items.map(({ section, title, rows, steps }) => `
              <div class="pp-section">
                <label class="pp-section-label">
                  <input type="checkbox" checked data-pp-section="${section.dataset.printId}">
                  <span>${title}</span>
                </label>
                ${rows.length ? `<div class="pp-sub">${rows.map((tr, i) => `
                  <label class="pp-row-label"><input type="checkbox" checked data-pp-row="${tr.dataset.printId}" data-pp-parent="${section.dataset.printId}"><span>${(tr.children[0] && tr.children[0].textContent.trim()) || `Строка ${i + 1}`}</span></label>
                `).join('')}</div>` : ''}
                ${steps.length ? `<div class="pp-sub">${steps.map((st, i) => {
                  const instr = st.querySelector('.instr');
                  const text = instr ? instr.textContent.replace(/^\d+/, '').trim() : `Вопрос ${i + 1}`;
                  return `<label class="pp-row-label"><input type="checkbox" checked data-pp-row="${st.dataset.printId}" data-pp-parent="${section.dataset.printId}"><span>${text}</span></label>`;
                }).join('')}</div>` : ''}
              </div>
            `).join('')}
          </div>
          <div class="print-picker-actions">
            <button class="secondary" id="pp-cancel">Отмена</button>
            <button id="pp-confirm">Печать</button>
          </div>
        </div>
      </div>
    `;
  }

  function openPrintPicker(onConfirm) {
    const items = collectSections();
    const wrap = document.createElement('div');
    wrap.innerHTML = buildModalHtml(items);
    document.body.appendChild(wrap.firstElementChild);
    const backdrop = document.getElementById('print-picker-backdrop');

    // Секция целиком выключает/включает свои строки одним кликом; галочка
    // секции сама становится «неопределённой», если часть строк снята вручную.
    backdrop.querySelectorAll('[data-pp-section]').forEach((cb) => {
      cb.addEventListener('change', () => {
        backdrop.querySelectorAll(`[data-pp-parent="${cb.dataset.ppSection}"]`).forEach((child) => {
          child.checked = cb.checked;
        });
      });
    });
    backdrop.querySelectorAll('[data-pp-row]').forEach((cb) => {
      cb.addEventListener('change', () => {
        const parentId = cb.dataset.ppParent;
        const siblings = [...backdrop.querySelectorAll(`[data-pp-parent="${parentId}"]`)];
        const parentCb = backdrop.querySelector(`[data-pp-section="${parentId}"]`);
        parentCb.checked = siblings.every((s) => s.checked);
        parentCb.indeterminate = !parentCb.checked && siblings.some((s) => s.checked);
      });
    });

    function close() { backdrop.remove(); }

    backdrop.querySelector('#pp-cancel').addEventListener('click', close);
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });

    backdrop.querySelector('#pp-confirm').addEventListener('click', () => {
      // Снять все прежние исключения (на случай повторного открытия) и
      // применить текущий выбор.
      document.querySelectorAll('.print-excluded').forEach((el) => el.classList.remove('print-excluded'));

      items.forEach(({ section, rows, steps }) => {
        const sectionChecked = backdrop.querySelector(`[data-pp-section="${section.dataset.printId}"]`).checked;
        if (!sectionChecked) {
          section.classList.add('print-excluded');
          return; // вся секция скрыта — содержимое можно не проверять
        }
        [...rows, ...steps].forEach((el) => {
          const rowCb = backdrop.querySelector(`[data-pp-row="${el.dataset.printId}"]`);
          if (rowCb && !rowCb.checked) el.classList.add('print-excluded');
        });
      });

      close();
      onConfirm();
    });
  }

  window.LabPrintPicker = { openPrintPicker };

})();
