/* ============================================================================
 * ФАЙЛ: src/utils/printRoofLayout.ts — Печать схемы укладки листов кровли на 1 лист A4
 * ЗА ЧТО ОТВЕЧАЕТ: Создаёт отдельный печатный документ с чертежом раскладки листов кровли, карточками размеров, легендой и итогом листов строго на 1 альбомной странице A4 без браузерных колонтитулов (без даты, URL сайта, дубля заголовка и номера страницы).
 * ОТКУДА БЕРЁТ ИНФОРМАЦИЮ: Получает рассчитанные параметры кровли (calc) и готовую SVG-разметку чертежа из компонента RoofLayout в файле src/components/RoofCalculator.tsx.
 * КАК ИЗМЕНИТЬ: Заголовок печатного листа, названия карточек («Кровля», «Лист», «Перехлёст», «Раскладка») и стили печатной страницы меняются внутри функции buildRoofLayoutPrintHtml.
 * ========================================================================= */

/* БЛОК: Структура данных расчёта кровли для печати и форматирование чисел (RoofLayoutPrintData)
 * ЗА ЧТО ОТВЕЧАЕТ: Описывает поля, которые передаются из калькулятора кровли на печать, и настраивает вывод чисел в русском формате (с запятой).
 * ОТКУДА БЕРЁТ ИНФОРМАЦИЮ: Заполняется результатом функции calcRoof() из src/components/RoofCalculator.tsx.
 * КАК ИЗМЕНИТЬ: Количество знаков после запятой для размеров в метрах меняется в fmt2 (minimumFractionDigits / maximumFractionDigits). */
export interface RoofLayoutPrintData {
  roofLength: number;
  roofWidth: number;
  sheetLength: number;
  sheetWidth: number;
  overlapW: number;
  overlapL: number;
  sheets: number;
  columns: number;
  rows: number;
  savedW: number;
  savedL: number;
  seams: number;
}

const fmt = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 });
const fmt2 = new Intl.NumberFormat("ru-RU", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/* БЛОК: Сборка печатного HTML-листа схемы укладки кровли (buildRoofLayoutPrintHtml)
 * ЗА ЧТО ОТВЕЧАЕТ: Верстает альбомный лист A4 (297×210 мм) с нулевыми полями @page { margin: 0 } и пустым <title></title>, чтобы браузер не печатал дату, URL сайта и номер страницы, и умещает всю схему ровно на 1 лист.
 * ОТКУДА БЕРЁТ ИНФОРМАЦИЮ: Числа из объекта calc, векторный чертёж из строки svg и признак наличия отходов hasWaste.
 * КАК ИЗМЕНИТЬ:
 *   — Заголовок на бумаге меняется в теге <h1>Схема укладки листов</h1>.
 *   — Подписи параметров меняются в блоке <div class="params">, а нижняя строка — в теге <footer>.
 *   — Максимальная высота чертежа на бумаге задаётся в .scheme svg (max-height: 118mm). */
export function buildRoofLayoutPrintHtml(
  calc: RoofLayoutPrintData,
  svg: string,
  hasWaste: boolean,
): string {
  const saved = calc.savedW + calc.savedL;
  const overlapX = Math.round(calc.overlapW * 1000);
  const overlapY = Math.round(calc.overlapL * 1000);

  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title></title>
<style>
  @page {
    size: A4 landscape;
    margin: 0;
  }
  * {
    box-sizing: border-box;
  }
  html, body {
    margin: 0;
    padding: 0;
    background: #fff;
    color: #14191b;
    font-family: "Onest", -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    height: 100%;
    overflow: hidden;
  }
  .page {
    box-sizing: border-box;
    width: 297mm;
    max-width: 100vw;
    height: 210mm;
    max-height: 210mm;
    padding: 8mm 12mm 7mm;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    overflow: hidden;
    break-after: avoid;
    page-break-after: avoid;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  header {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 16px;
    padding-bottom: 6px;
    border-bottom: 2px solid #20282b;
    flex-shrink: 0;
  }
  h1 {
    margin: 0;
    font-size: 19pt;
    line-height: 1.1;
    font-weight: 900;
    letter-spacing: -0.01em;
  }
  .total {
    text-align: right;
    white-space: nowrap;
  }
  .total strong {
    display: block;
    color: #20282b;
    font-size: 22pt;
    line-height: 1;
    font-weight: 900;
  }
  .total span {
    color: #687276;
    font-size: 8pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .params {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    margin: 6px 0;
    border: 1px solid #e5e4e0;
    background: #fff;
    flex-shrink: 0;
  }
  .param {
    padding: 5px 10px;
    border-right: 1px solid #e5e4e0;
  }
  .param:last-child {
    border-right: 0;
  }
  .param span {
    display: block;
    color: #687276;
    font-size: 7.5pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .param b {
    display: block;
    margin-top: 1px;
    font-size: 10.5pt;
    font-weight: 800;
  }

  .scheme {
    padding: 4px;
    border: 1px solid #e5e4e0;
    background: #fff;
    flex: 1 1 auto;
    min-height: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .scheme svg {
    display: block;
    width: 100% !important;
    max-width: 100% !important;
    height: 100% !important;
    max-height: 118mm !important;
    object-fit: contain;
  }

  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 16px;
    margin-top: 5px;
    font-size: 8pt;
    font-weight: 600;
    flex-shrink: 0;
  }
  .legend span {
    display: inline-flex;
    align-items: center;
    gap: 5px;
  }
  .swatch {
    width: 18px;
    height: 8px;
    border: 1px solid #98a2a8;
    background: #fff;
    display: inline-block;
  }
  .swatch.overlap {
    border-color: #a98700;
    background: #fff3bf;
  }
  .swatch.saved {
    border-color: #2f8f5b;
    background: #e2f3e8;
  }
  .swatch.sheet {
    border-color: #68798a;
    background: #eaf0f6;
  }

  footer {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    margin-top: 5px;
    padding-top: 5px;
    border-top: 1px solid #e5e4e0;
    color: #687276;
    font-size: 7.5pt;
    font-weight: 600;
    flex-shrink: 0;
  }

  .no-print {
    margin-top: 10px;
    text-align: center;
  }
  .no-print button {
    padding: 8px 18px;
    border: 0;
    border-radius: 8px;
    background: #ffcb05;
    color: #20282b;
    font: inherit;
    font-weight: 800;
    cursor: pointer;
  }

  @media print {
    .no-print {
      display: none !important;
    }
    html, body {
      width: 297mm !important;
      height: 210mm !important;
      max-height: 210mm !important;
      overflow: hidden !important;
    }
    .page {
      width: 297mm !important;
      height: 210mm !important;
      max-height: 210mm !important;
      padding: 7mm 11mm 6mm !important;
      overflow: hidden !important;
    }
  }
</style>
</head>
<body>
  <div class="page">
    <header>
      <h1>Схема укладки листов</h1>
      <div class="total">
        <strong>${fmt.format(calc.sheets)} шт</strong>
        <span>Итого листов</span>
      </div>
    </header>

    <div class="params">
      <div class="param">
        <span>Кровля</span>
        <b>${fmt2.format(calc.roofLength)} × ${fmt2.format(calc.roofWidth)} м</b>
      </div>
      <div class="param">
        <span>Лист</span>
        <b>${fmt2.format(calc.sheetLength)} × ${fmt2.format(calc.sheetWidth)} м</b>
      </div>
      <div class="param">
        <span>Перехлёст</span>
        <b>${fmt.format(overlapX)} × ${fmt.format(overlapY)} мм</b>
      </div>
      <div class="param">
        <span>Раскладка</span>
        <b>${fmt.format(calc.columns)} в ряду · ${fmt.format(calc.rows)} рядов</b>
      </div>
    </div>

    <div class="scheme">${svg}</div>

    <div class="legend">
      <span><i class="swatch sheet"></i>лист</span>
      <span><i class="swatch overlap"></i>перехлёст ${fmt.format(overlapX)} × ${fmt.format(overlapY)} мм</span>
      ${saved > 0 ? '<span><i class="swatch saved"></i>остаток листа используется повторно</span>' : ""}
      <span><i class="swatch"></i>${hasWaste ? "отход подрезки" : "без отходов"}</span>
    </div>

    <footer>
      <span>Полос перехлёста: ${fmt.format(calc.seams)}${saved > 0 ? ` · сэкономлено листов за счёт обрезков: ${fmt.format(saved)}` : ""}</span>
      <span>Полезная площадь: ${fmt2.format(calc.roofLength * calc.roofWidth)} м²</span>
    </footer>
  </div>

  <div class="no-print">
    <button type="button" onclick="window.print()">Печать / сохранить в PDF</button>
  </div>

  <script>
    document.title = "";
    window.addEventListener("load", function () {
      document.title = "";
      setTimeout(function () {
        document.title = "";
        window.print();
      }, 150);
    });
  </script>
</body>
</html>`;
}

/* БЛОК: Открытие окна печати схемы кровли (printRoofLayout)
 * ЗА ЧТО ОТВЕЧАЕТ: Вызывается по клику на кнопку «Печать» в блоке «Схема укладки листов», открывает отдельное окно с готовым листом A4 и запускает печать.
 * ОТКУДА БЕРЁТ ИНФОРМАЦИЮ: Принимает расчёт calc, строку SVG-схемы и флаг отходов из src/components/RoofCalculator.tsx.
 * КАК ИЗМЕНИТЬ: Менять не требуется; если окно заблокировано браузером, функция вернёт false и калькулятор покажет подсказку пользователю. */
export function printRoofLayout(
  calc: RoofLayoutPrintData,
  svg: string,
  hasWaste: boolean,
): boolean {
  if (!svg) return false;

  try {
    const win = window.open("", "_blank", "width=1200,height=850");
    if (!win) return false;

    try {
      win.document.open();
      win.document.write(buildRoofLayoutPrintHtml(calc, svg, hasWaste));
      win.document.close();
      win.document.title = "";
      win.focus();
      return true;
    } catch {
      try {
        win.close();
      } catch {}
      return false;
    }
  } catch {
    return false;
  }
}
