/* ============================================================================
 * ФАЙЛ: src/utils/printSidingLayout.ts — Печать плана фасада и спецификации сайдинга на 1 лист A4
 * ЗА ЧТО ОТВЕЧАЕТ: Собирает одностраничный альбомный лист A4 с планом фасада слева и таблицей всех элементов ПВХ сайдинга справа и сразу открывает системное окно печати — прямо на текущей странице, без новой вкладки (так же, как кнопка «Печать» на странице «Грильято»).
 * ОТКУДА БЕРЁТ ИНФОРМАЦИЮ: Получает результат расчёта calcSiding() из src/data/siding.ts, готовую SVG-разметку плана фасада и название выбранного цвета из src/components/SidingCalculator.tsx.
 * КАК ИЗМЕНИТЬ: Заголовок «Фасад · ПВХ сайдинг», подписи параметров и пропорции колонок меняются в функциях buildSidingSheetMarkup и SHEET_CSS ниже.
 * ========================================================================= */

import type { SidingCalc } from "../data/siding";

const fmt = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 });
const fmt2 = new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const ROOT_CLASS = "siding-print-root";

/* БЛОК: Стили печатного листа (SHEET_CSS)
 * ЗА ЧТО ОТВЕЧАЕТ: Альбомный лист A4 без полей и колонтитулов; все правила ограничены контейнером .siding-print-root, чтобы не задевать сам сайт.
 * ОТКУДА БЕРЁТ ИНФОРМАЦИЮ: Задано здесь.
 * КАК ИЗМЕНИТЬ: Соотношение ширины схемы и таблицы — grid-template-columns у .sp-body. */
const R = `.${ROOT_CLASS}`;
const SHEET_CSS = `
${R} { display: none; }
@media print {
  @page { size: A4 landscape; margin: 0; }
  body.spec-print-overlay #root { display: none !important; }
  body.spec-print-overlay ${R} { display: block !important; }
  body.spec-print-overlay ${R}, body.spec-print-overlay ${R} * { visibility: visible !important; }
  ${R} * { box-sizing: border-box; }
  ${R} {
    color: #14191b; background: #fff;
    font-family: "Onest", -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  ${R} .sp-page {
    width: 297mm; height: 210mm; padding: 7mm 11mm 6mm; overflow: hidden;
    display: flex; flex-direction: column; break-inside: avoid;
  }
  ${R} .sp-head { padding-bottom: 6px; border-bottom: 2px solid #20282b; flex-shrink: 0; }
  ${R} h1 { margin: 0; font-size: 18pt; line-height: 1.1; font-weight: 900; }
  ${R} .sp-params { display: grid; grid-template-columns: repeat(5, 1fr); margin: 6px 0; border: 1px solid #e5e4e0; flex-shrink: 0; }
  ${R} .sp-param { padding: 4px 9px; border-right: 1px solid #e5e4e0; }
  ${R} .sp-param:last-child { border-right: 0; }
  ${R} .sp-param span { display: block; color: #687276; font-size: 7pt; font-weight: 700; text-transform: uppercase; }
  ${R} .sp-param b { display: block; margin-top: 1px; font-size: 10pt; font-weight: 800; }
  ${R} .sp-body { display: grid; grid-template-columns: 1.35fr 1.15fr; gap: 10px; flex: 1 1 auto; min-height: 0; }
  ${R} .sp-scheme { border: 1px solid #e5e4e0; padding: 4px; min-height: 0; overflow: hidden; display: flex; align-items: center; justify-content: center; }
  ${R} .sp-scheme svg { display: block; width: 100% !important; height: 100% !important; max-height: 150mm !important; }
  ${R} table { width: 100%; border-collapse: collapse; font-size: 8.5pt; align-self: start; }
  ${R} th { text-align: left; font-size: 7pt; text-transform: uppercase; letter-spacing: 0.05em; color: #687276; border-bottom: 1.5px solid #20282b; padding: 4px 6px; }
  ${R} td { padding: 4px 6px; border-bottom: 1px solid #e5e4e0; vertical-align: top; }
  ${R} td.n { width: 18px; color: #98a2a8; }
  ${R} td.name { font-weight: 700; }
  ${R} td.qty { text-align: right; font-weight: 800; white-space: nowrap; }
  ${R} .clr { color: #687276; font-weight: 600; }
  ${R} .cuts { margin-top: 3px; color: #687276; font-size: 6.2pt; line-height: 1.25; font-weight: 500; }
  ${R} .cuts b { color: #14191b; font-weight: 800; }
}
`;

/* БЛОК: Разметка печатного листа (buildSidingSheetMarkup)
 * ЗА ЧТО ОТВЕЧАЕТ: Заголовок, 5 параметров (фасад, площадь, ряды, проёмы, цвет), план фасада и таблица элементов с раскроем панелей мелким шрифтом под строкой «Сайдинг».
 * ОТКУДА БЕРЁТ ИНФОРМАЦИЮ: Объект calc, SVG-план и название цвета.
 * КАК ИЗМЕНИТЬ: Поменяйте подписи параметров в блоке sp-params. */
function buildSidingSheetMarkup(calc: SidingCalc, svg: string, colorName: string): string {
  const cutDetails = calc.panelPlan
    .filter((panel) => panel.items.length > 1)
    .map((panel) => {
      const pieces = panel.items
        .map((item) => `${item.label}: ${fmt.format(item.lenMm / 1000)} м, ряд ${item.row + 1}`)
        .join("; ");
      return `Панель ${panel.panel}: ${pieces}${panel.wasteMm > 0 ? `; остаток ${fmt.format(panel.wasteMm / 1000)} м` : "; без остатка"}`;
    })
    .join("<br>");

  const rows = calc.table
    .map(
      (r, i) => `<tr>
        <td class="n">${i + 1}</td>
        <td class="name">${r.shortName ?? r.name}${r.colorName ? `<span class="clr"> · ${r.colorName.toLowerCase()}</span>` : ""}${i === 0 && cutDetails ? `<div class="cuts"><b>Раскрой:</b><br>${cutDetails}</div>` : ""}</td>
        <td class="qty">${r.qty > 0 ? `${fmt.format(r.qty)} шт` : "—"}</td>
      </tr>`,
    )
    .join("");

  return `<div class="sp-page">
    <div class="sp-head"><h1>Фасад · ПВХ сайдинг</h1></div>
    <div class="sp-params">
      <div class="sp-param"><span>Фасад</span><b>${fmt2.format(calc.L / 1000)} × ${fmt2.format(calc.H / 1000)} м</b></div>
      <div class="sp-param"><span>Площадь обшивки</span><b>${fmt.format(calc.netArea)} м²</b></div>
      <div class="sp-param"><span>Рядов панелей</span><b>${fmt.format(calc.rows)}</b></div>
      <div class="sp-param"><span>Проёмов</span><b>${fmt.format(calc.openings.length)}</b></div>
      <div class="sp-param"><span>Цвет</span><b>${colorName}</b></div>
    </div>
    <div class="sp-body">
      <div class="sp-scheme">${svg}</div>
      <table>
        <thead><tr><th></th><th>Элемент</th><th style="text-align:right">Кол-во</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  </div>`;
}

/* БЛОК: Запуск печати прямо на странице (printSidingOverlay)
 * ЗА ЧТО ОТВЕЧАЕТ: Временно добавляет на страницу скрытый лист и стили, прячет сайт на время печати, вызывает window.print() и после закрытия окна печати всё убирает.
 * ОТКУДА БЕРЁТ ИНФОРМАЦИЮ: Вызывается кнопкой «Печать» в блоке «План фасада» (src/components/SidingCalculator.tsx).
 * КАК ИЗМЕНИТЬ: Не требует изменений. */
export function printSidingOverlay(calc: SidingCalc, svg: string, colorName: string): boolean {
  if (!svg) return false;
  const body = document.body;

  const style = document.createElement("style");
  style.textContent = SHEET_CSS;
  const root = document.createElement("div");
  root.className = ROOT_CLASS;
  root.setAttribute("aria-hidden", "true");
  root.innerHTML = buildSidingSheetMarkup(calc, svg, colorName);

  const originalTitle = document.title;
  let restored = false;
  const restore = () => {
    if (restored) return;
    restored = true;
    document.title = originalTitle;
    body.classList.remove("spec-print-active", "spec-print-overlay");
    style.remove();
    root.remove();
    window.removeEventListener("afterprint", restore);
  };

  document.head.appendChild(style);
  body.appendChild(root);
  document.title = " ";
  body.classList.add("spec-print-active", "spec-print-overlay");
  window.addEventListener("afterprint", restore);
  window.print();
  return true;
}
