/* ============================================================================
 * ФАЙЛ: src/components/SidingCalculator.tsx — Интерактивный калькулятор ПВХ сайдинга
 * ЗА ЧТО ОТВЕЧАЕТ: Отображает полный расчёт обшивки фасада ПВХ сайдингом (на страницах #/siding и #/test): размеры стены, процент запаса, переключатель верхней финишной планки, выбор профилей левого и правого краёв, добавление и настройку окон/дверей, кликабельный план фасада с полноэкранным зумом и печатью на 1 лист A4, ведомость раскроя обрезков и итоговую спецификацию всех 8 материалов.
 * ОТКУДА БЕРЁТ ИНФОРМАЦИЮ: Вся математика раскроя, габариты элементов и стартовый пример приходят из src/data/siding.ts, сохранённый ввод пользователя — из localStorage ("siding:input"), печать — из src/utils/printSidingLayout.ts, полноэкранное окно плана — из src/components/SidingPlanLightbox.tsx.
 * КАК ИЗМЕНИТЬ:
 *   — Габариты панелей/планок и формулы расчёта меняются в файле src/data/siding.ts.
 *   — Подписи кнопок, заголовки блоков, цвета линий на плане фасада и колонки таблицы меняются в блоках ниже.
 * ========================================================================= */

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  AppWindow,
  ChevronDown,
  DoorOpen,
  LayoutGrid,
  MoveHorizontal,
  MoveVertical,
  PackagePlus,
  Palette,
  Plus,
  Printer,
  Ruler,
  Trash2,
} from "lucide-react";
import {
  DEFAULT_SIDING,
  EDGE_LABELS,
  SIDING_TRIM_PARTS,
  SIDING_TRIM_ROW_KEYS,
  calcSiding,
  getAvailableSidingColors,
  getSidingPanelColor,
  getTrimColor,
  getUnifiedSidingColors,
  normalizeTrimColors,
  clampOpening,
  createOpening,
  getVisibleSidingRects,
  openingLetter,
  type EdgeTrim,
  type FacadeOpening,
  type SidingInput,
  type SidingTrimPart,
} from "../data/siding";
import { fmt, fmtPrice } from "../data/grilyato";
import { SPEC_PRICE_SHEET, usePrices } from "../data/prices";
import { loadSettings } from "../data/siteSettings";
import ArticleCell from "./ArticleCell";
import { printSidingOverlay } from "../utils/printSidingLayout";
import SidingPlanLightbox, { PlanZoomHint } from "./SidingPlanLightbox";
import { cn } from "../utils/cn";

/* БЛОК: Загрузка сохранённых параметров фасада из памяти браузера (loadInput)
 * ЗА ЧТО ОТВЕЧАЕТ: Читает предыдущий ввод посетителя из localStorage, чтобы при перезагрузке страницы его окна, двери и размеры фасада не сбрасывались.
 * ОТКУДА БЕРЁТ ИНФОРМАЦИЮ: Ключ "siding:input" в localStorage и стартовый объект DEFAULT_SIDING из src/data/siding.ts.
 * КАК ИЗМЕНИТЬ: Чтобы поменять начальный пример для новых посетителей, отредактируйте DEFAULT_SIDING в src/data/siding.ts. */
const ease = [0.22, 1, 0.36, 1] as const;
const STORAGE_KEY = "siding:input";
const MONO = "'JetBrains Mono', ui-monospace, monospace";

const fmt2 = new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const m2 = (v: number) => fmt2.format(Math.round(v * 100) / 100);

function loadInput(): SidingInput {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    /* Новый посетитель: стартовый фасад из админки («Настройка страниц» → «Сайдинг») */
    if (!raw) {
      const start = loadSettings().calculators.siding;
      return {
        ...DEFAULT_SIDING,
        facadeLength: start.facadeLength,
        facadeHeight: start.facadeHeight,
        sparePct: start.sparePct,
        straightTop: start.straightTop,
        leftEdge: start.leftEdge,
        rightEdge: start.rightEdge,
        singleColor: start.singleColor,
        openings: DEFAULT_SIDING.openings.map((o) => clampOpening(o, start.facadeLength, start.facadeHeight)),
      };
    }
    const parsed = JSON.parse(raw) as Partial<SidingInput>;
    return {
      ...DEFAULT_SIDING,
      ...parsed,
      sparePct:
        typeof parsed.sparePct === "number" && parsed.sparePct >= 0 && parsed.sparePct <= 50
          ? parsed.sparePct
          : DEFAULT_SIDING.sparePct,
      openings: Array.isArray(parsed.openings) ? parsed.openings : DEFAULT_SIDING.openings,
      colorId: getSidingPanelColor(String(parsed.colorId ?? "")).id,
      trimColors: normalizeTrimColors(parsed.trimColors),
      singleColor: parsed.singleColor === true,
    };
  } catch {
    return DEFAULT_SIDING;
  }
}

/* БЛОК: Числовое поле ввода размеров стены и проёмов (SidingField)
 * ЗА ЧТО ОТВЕЧАЕТ: Принимает числа в метрах с точкой или запятой как в обычном режиме (длина/высота фасада), так и в компактном (габариты и отступы окна/двери).
 * ОТКУДА БЕРЁТ ИНФОРМАЦИЮ: Значение value и подпись label из родительского компонента.
 * КАК ИЗМЕНИТЬ: Ширина и шрифт поля регулируются условием compact ? "w-full text-[15px]" : "w-[110px] text-[17px]". */
function SidingField({
  label,
  value,
  unit = "м",
  onChange,
  icon: Icon,
  compact = false,
}: {
  label: string;
  value: number;
  unit?: string;
  onChange: (v: number) => void;
  icon?: typeof Ruler;
  compact?: boolean;
}) {
  const [text, setText] = useState(String(value).replace(".", ","));
  useEffect(() => setText(String(value).replace(".", ",")), [value]);

  const commit = (raw: string) => {
    setText(raw);
    const parsed = parseFloat(raw.replace(",", "."));
    if (Number.isFinite(parsed) && parsed >= 0) onChange(parsed);
  };

  return (
    <div>
      <div className={cn("flex items-end justify-between gap-3", compact && "flex-col items-stretch gap-1")}>
        <label className="flex items-center gap-1.5 text-[13px] font-bold text-graphite/70">
          {Icon && <Icon size={14} strokeWidth={2.4} className="text-graphite/40" />}
          <span className={cn(compact && "text-[11px] uppercase tracking-wide text-graphite/50")}>{label}</span>
        </label>
        <div className="flex items-baseline gap-1">
          <input
            value={text}
            onChange={(e) => commit(e.target.value)}
            onBlur={() => setText(String(value).replace(".", ","))}
            inputMode="decimal"
            aria-label={label}
            className={cn(
              "no-spin rounded-lg border border-transparent bg-smoke px-2 py-1 text-right font-extrabold tabular outline-none transition-colors focus:border-pro",
              compact ? "w-full text-[15px]" : "w-[110px] text-[17px]",
            )}
          />
          <span className="text-[13px] font-semibold text-graphite/50">{unit}</span>
        </div>
      </div>
    </div>
  );
}

/* БЛОК: Переключатель профиля для левого и правого края фасада (EDGE_OPTIONS, EdgePicker)
 * ЗА ЧТО ОТВЕЧАЕТ: Выводит три кнопки выбора завершения стены сбоку: «J профиль», «Внутр. угол» или «Наруж. угол».
 * ОТКУДА БЕРЁТ ИНФОРМАЦИЮ: Текущее значение value (input.leftEdge или input.rightEdge).
 * КАК ИЗМЕНИТЬ: Короткие подписи на кнопках меняются в массиве EDGE_OPTIONS ниже. */
const EDGE_OPTIONS: { key: EdgeTrim; label: string }[] = [
  { key: "j", label: "J профиль" },
  { key: "inner", label: "Внутр. угол" },
  { key: "outer", label: "Наруж. угол" },
];

function EdgePicker({
  title,
  value,
  onChange,
}: {
  title: string;
  value: EdgeTrim;
  onChange: (v: EdgeTrim) => void;
}) {
  return (
    <div>
      <div className="mb-1.5 text-[11.5px] font-bold uppercase tracking-wider text-graphite/50">{title}</div>
      <div className="grid grid-cols-3 gap-1 rounded-xl bg-smoke p-1">
        {EDGE_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            type="button"
            onClick={() => onChange(opt.key)}
            aria-pressed={value === opt.key}
            className={cn(
              "rounded-lg px-2 py-2 text-[11.5px] font-extrabold transition-all",
              value === opt.key
                ? "bg-graphite text-white shadow-sm"
                : "text-graphite/55 hover:bg-white hover:text-graphite",
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* БЛОК: Векторный чертёж «План фасада» (EDGE_COLORS, FacadeScheme)
 * ЗА ЧТО ОТВЕЧАЕТ: Рисует стену в масштабе, горизонтальные ряды по 203 мм, номера заготовок с жёлтой подсветкой панелей, где обрезки пошли в дело, пунктирные линии H-профиля каждые 3 м, стартовую и финишную планки, цветные края фасада и окна/двери с буквенными метками А, Б, В…
 * ОТКУДА БЕРЁТ ИНФОРМАЦИЮ: Рассчитанный объект calc (из calcSiding) и параметры input.
 * КАК ИЗМЕНИТЬ: Палитра панелей, планок, H-профилей и штриховки задаётся в SidingColor.scheme (src/data/siding.ts); окна и размерные линии не зависят от цвета сайдинга. */

function FacadeScheme({
  calc,
  input,
  svgRef,
}: {
  calc: ReturnType<typeof calcSiding>;
  input: SidingInput;
  svgRef: React.RefObject<SVGSVGElement | null>;
}) {
  const color = getSidingPanelColor(input.colorId);
  const scheme = color.scheme;
  /* Цвета комплектующих соответствуют выбранным вариантам товаров MONLID. */
  const hTone = getTrimColor(input, "hProfile").scheme;
  const finishTone = getTrimColor(input, "finish").scheme;
  const jTone = getTrimColor(input, "jProfile").scheme;
  const jambColor = getTrimColor(input, "jamb");
  const edgeTone = (edge: EdgeTrim) =>
    getTrimColor(input, edge === "j" ? "jProfile" : edge === "inner" ? "innerCorner" : "outerCorner").scheme;
  const VIEW_W = 680;
  const VIEW_H = 470;
  const M_LEFT = 52;
  const M_RIGHT = 16;
  const M_TOP = 18;
  const M_BOTTOM = 54;

  const Lm = calc.L / 1000;
  const Hm = calc.H / 1000;
  const availW = VIEW_W - M_LEFT - M_RIGHT;
  const availH = VIEW_H - M_TOP - M_BOTTOM;
  const scale = Math.min(availW / Lm, availH / Hm);

  const W = Lm * scale;
  const H = Hm * scale;
  const ox = M_LEFT + (availW - W) / 2;
  const oy = M_TOP + (availH - H) / 2;
  const right = ox + W;
  const bottom = oy + H;

  const rowH = (203 / 1000) * scale;
  const seamStep = 3 * scale;
  const edgeW = Math.max(4, Math.min(9, 0.09 * scale));

  const xToPx = (m: number) => ox + m * scale;
  const yToPx = (m: number) => bottom - m * scale;

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      className="mx-auto block h-auto w-full min-w-[540px]"
      role="img"
      aria-label={`Фасад ${m2(Lm)} на ${m2(Hm)} метров, рядов панелей ${calc.rows}, проёмов ${calc.openings.length}, цвет сайдинга ${color.name}`}
      xmlns="http://www.w3.org/2000/svg"
      data-siding-color={input.colorId}
    >
      <defs>
        <marker id="dim-a" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M 0 2 L 8 5 L 0 8" fill="none" stroke="#46555f" strokeWidth="1.4" />
        </marker>
        <pattern id="h-seam-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" stroke={hTone.trimEdge} strokeWidth="1.6" />
        </pattern>
      </defs>

      <rect x={ox} y={oy} width={W} height={H} fill={scheme.panel} stroke={scheme.outline} strokeWidth="1.4" />

      {Array.from({ length: calc.rows - 1 }, (_, i) => {
        const y = bottom - (i + 1) * rowH;
        if (y <= oy + 1) return null;
        return <line key={`row-${i}`} x1={ox} y1={y} x2={right} y2={y} stroke={scheme.panelLine} strokeWidth="0.8" />;
      })}

      {calc.pieces.map((p) => {
        const x = ox + (p.x0 / 1000) * scale;
        const w = ((p.x1 - p.x0) / 1000) * scale;
        const yTop = Math.max(oy, bottom - (p.row + 1) * rowH);
        const yBottom = bottom - p.row * rowH;
        const multi = (calc.panelPlan[p.panel - 1]?.items.length ?? 0) > 1;
        const visible = getVisibleSidingRects(p, calc.H, calc.openings);
        const labelArea = visible
          .filter((rect) =>
            ((rect.x1 - rect.x0) / 1000) * scale >= Math.max(26, p.label.length * 5.2 + 4) &&
            ((rect.y1 - rect.y0) / 1000) * scale >= 11,
          )
          .sort((a, b) =>
            (b.x1 - b.x0) * (b.y1 - b.y0) - (a.x1 - a.x0) * (a.y1 - a.y0),
          )[0];
        return (
          <g
            key={`${p.panel}-${p.row}-${p.x0}`}
            data-siding-piece={p.label}
            data-row={p.row}
          >
            <title>{`Панель ${p.label}: заготовка ${p.lenMm} мм, ряд ${p.row + 1}${p.near ? `, ${p.near}` : ""}`}</title>
            {visible.map((rect, index) => (
              <rect
                key={index}
                x={xToPx(rect.x0 / 1000)}
                y={yToPx(rect.y1 / 1000)}
                width={((rect.x1 - rect.x0) / 1000) * scale}
                height={((rect.y1 - rect.y0) / 1000) * scale}
                fill={multi ? scheme.tint : "transparent"}
                fillOpacity={multi ? 0.38 : 1}
              />
            ))}
            {p.x1 < calc.L && (
              <line x1={x + w} y1={yTop} x2={x + w} y2={yBottom} stroke={scheme.seam} strokeWidth="0.8" />
            )}
            {labelArea && (
              <text
                x={xToPx((labelArea.x0 + labelArea.x1) / 2000)}
                y={yToPx((labelArea.y0 + labelArea.y1) / 2000) + 3}
                textAnchor="middle"
                fontSize="8.5"
                fontWeight="700"
                fill={scheme.label}
                fontFamily={MONO}
              >
                {p.label}
              </text>
            )}
          </g>
        );
      })}

      {/* H-профиль: две параллельные пунктирные линии по краям полосы и диагональная штриховка между ними (реальная ширина профиля 73 мм в масштабе чертежа) */}
      {Array.from({ length: calc.seamLines }, (_, i) => {
        const x = ox + (i + 1) * seamStep;
        const hw = Math.max(2.5, (0.073 / 2) * scale);
        return (
          <g key={`seam-${i}`}>
            <rect x={x - hw} y={oy} width={hw * 2} height={H} fill={hTone.trim} />
            <rect x={x - hw} y={oy} width={hw * 2} height={H} fill="url(#h-seam-hatch)" fillOpacity="0.55" />
            <line x1={x - hw} y1={oy} x2={x - hw} y2={bottom} stroke={hTone.seam} strokeWidth="1.2" strokeDasharray="5 4" />
            <line x1={x + hw} y1={oy} x2={x + hw} y2={bottom} stroke={hTone.seam} strokeWidth="1.2" strokeDasharray="5 4" />
          </g>
        );
      })}

      <rect x={ox} y={bottom - 3.5} width={W} height={3.5} fill={scheme.trim} stroke={scheme.trimEdge} strokeWidth="0.6" />
      {input.straightTop && <rect x={ox} y={oy} width={W} height={3} fill={finishTone.trim} stroke={finishTone.trimEdge} strokeWidth="0.6" />}

      <rect x={ox} y={oy} width={edgeW} height={H} fill={edgeTone(input.leftEdge).trim} stroke={edgeTone(input.leftEdge).trimEdge} strokeWidth="0.8" />
      <rect x={right - edgeW} y={oy} width={edgeW} height={H} fill={edgeTone(input.rightEdge).trim} stroke={edgeTone(input.rightEdge).trimEdge} strokeWidth="0.8" />

      {calc.openings.map((o, i) => {
        const x = xToPx(o.x);
        const y = yToPx(o.y + o.height);
        const w = o.width * scale;
        const h = o.height * scale;
        const cx = x + w / 2;
        const cy = y + h / 2;
        const isJamb = o.trim === "jamb";
        const trimW = Math.max(6.5, Math.min(10.5, 0.085 * scale));
        const trimFill = isJamb ? (jambColor.id === "white" ? "#ffffff" : jambColor.scheme.trim) : jTone.trim;
        const trimStroke = isJamb ? (jambColor.id === "white" ? "#98a6b5" : jambColor.scheme.trimEdge) : jTone.trimEdge;
        const label = `${o.kind === "window" ? "Окно" : "Дверь"} ${openingLetter(i)}`;
        const trimPath = `M ${x - trimW} ${y + h} V ${y - trimW} H ${x + w + trimW} V ${y + h} H ${x + w} V ${y} H ${x} V ${y + h} Z`;

        return (
          <g key={o.id}>
            {/* Обрамление проёма с трёх сторон (лево, верх, право) наружу от окна/двери */}
            <path
              d={trimPath}
              fill={trimFill}
              stroke={trimStroke}
              strokeWidth="0.8"
            />
            {/* Угловые стыки профилей под 45° */}
            <line x1={x - trimW} y1={y - trimW} x2={x} y2={y} stroke={trimStroke} strokeWidth="0.8" />
            <line x1={x + w + trimW} y1={y - trimW} x2={x + w} y2={y} stroke={trimStroke} strokeWidth="0.8" />

            <rect x={x} y={y} width={w} height={h} fill="#fff" stroke="#1f4f8a" strokeWidth="1.2">
              <title>{`${label}: ${m2(o.width)} × ${m2(o.height)} м · от левого края ${m2(o.x)} м · от низа ${m2(o.y)} м`}</title>
            </rect>
            {o.kind === "window" ? (
              <g stroke="#9db4cc" strokeWidth="0.9">
                <line x1={cx} y1={y} x2={cx} y2={y + h} />
                <line x1={x} y1={cy} x2={x + w} y2={cy} />
              </g>
            ) : (
              <circle cx={x + w - Math.min(9, w * 0.18)} cy={cy} r={2.2} fill="#1f4f8a" />
            )}
            {w > 20 && h > 18 && (
              <text
                x={cx}
                y={cy + 5.5}
                textAnchor="middle"
                fontSize="13"
                fontWeight="900"
                fill="#20282b"
                fontFamily={MONO}
              >
                {openingLetter(i)}
              </text>
            )}
          </g>
        );
      })}

      <g fontFamily={MONO}>
        <line
          x1={ox}
          y1={bottom + 22}
          x2={right}
          y2={bottom + 22}
          stroke="#46555f"
          strokeWidth="1"
          markerStart="url(#dim-a)"
          markerEnd="url(#dim-a)"
        />
        <text
          x={(ox + right) / 2}
          y={bottom + 37}
          textAnchor="middle"
          fontSize="11.5"
          fontWeight="800"
          fill="#20282b"
        >
          длина {m2(Lm)} м
        </text>
        <line x1={ox - 18} y1={oy} x2={ox - 18} y2={bottom} stroke="#46555f" strokeWidth="1" markerStart="url(#dim-a)" markerEnd="url(#dim-a)" />
        <text
          x={ox - 26}
          y={(oy + bottom) / 2}
          textAnchor="middle"
          fontSize="11.5"
          fontWeight="800"
          fill="#20282b"
          transform={`rotate(-90 ${ox - 26} ${(oy + bottom) / 2})`}
        >
          высота {m2(Hm)} м
        </text>
      </g>

      <text x={ox} y={oy - 6} fontSize="9.5" fontWeight="700" fill={scheme.label} fontFamily={MONO}>
        ← {EDGE_LABELS[input.leftEdge]}
      </text>
      <text x={right} y={oy - 6} textAnchor="end" fontSize="9.5" fontWeight="700" fill={scheme.label} fontFamily={MONO}>
        {EDGE_LABELS[input.rightEdge]} →
      </text>
    </svg>
  );
}

/* БЛОК: Главный компонент калькулятора ПВХ сайдинга (SidingCalculator)
 * ЗА ЧТО ОТВЕЧАЕТ: Управляет состоянием стены и проёмов, вызывает расчёт calcSiding(input), сохраняет параметры в браузер и собирает левую панель настроек и правую колонку результатов.
 * ОТКУДА БЕРЁТ ИНФОРМАЦИЮ: Функция calcSiding() из src/data/siding.ts и сохранённое состояние loadInput().
 * КАК ИЗМЕНИТЬ: Каждый визуальный узел подписан в JSX ниже — редактируйте нужные заголовки и подписи прямо на месте. */
export default function SidingCalculator({
  background = "smoke",
}: {
  background?: "white" | "smoke";
}) {
  const [input, setInput] = useState<SidingInput>(loadInput);
  const [printError, setPrintError] = useState(false);
  const [planZoomed, setPlanZoomed] = useState(false);
  const [cutPlanOpen, setCutPlanOpen] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const { prices, status: priceStatus } = usePrices(SPEC_PRICE_SHEET);

  const calc = useMemo(() => calcSiding(input), [input]);
  const unifiedColors = useMemo(() => getUnifiedSidingColors(calc.table), [calc.table]);

  // В режиме «Один цвет» сохраняем только оттенок, доступный для всех нужных товаров.
  // Например, околооконная планка бывает только белой и коричневой, а панели — не коричневые.
  useEffect(() => {
    if (input.singleColor && !unifiedColors.some((item) => item.id === input.colorId)) {
      setInput((prev) => (prev.singleColor ? { ...prev, colorId: "white" } : prev));
    }
  }, [input.singleColor, input.colorId, unifiedColors]);

  /* БЛОК: Строки спецификации с ценами | ОТКУДА ДАННЫЕ: Товары и артикулы выбранных цветов — из calc.table и sidingCatalog.ts; цены и ссылки — из Google-таблицы.
     Позиции с количеством 0 (элемент не нужен для этого фасада) в спецификацию не попадают. */
  const specRows = useMemo(
    () =>
      calc.table
        .filter((r) => r.qty > 0)
        .map((r) => {
          const entry = r.art ? prices[r.art] : undefined;
          const price = entry?.price ?? 0;
          return { ...r, price, sum: Math.round(r.qty * price * 100) / 100, url: entry?.url, missing: !entry };
        }),
    [calc.table, prices],
  );
  const specTotal = specRows.reduce((sum, r) => sum + (r.missing ? 0 : r.sum), 0);
  const specMissing = specRows.filter((r) => r.missing).length;
  const specSkipped = calc.table.length - specRows.length;

  useEffect(() => {
    setPlanZoomed(false);
  }, [input]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(input));
    } catch {}
  }, [input]);

  const set = <K extends keyof SidingInput>(key: K, value: SidingInput[K]) =>
    setInput((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "facadeLength" || key === "facadeHeight") {
        next.openings = next.openings.map((o) => clampOpening(o, next.facadeLength, next.facadeHeight));
      }
      return next;
    });

  const patchOpening = (id: string, changes: Partial<FacadeOpening>) =>
    setInput((prev) => ({
      ...prev,
      openings: prev.openings.map((o) =>
        o.id === id ? clampOpening({ ...o, ...changes }, prev.facadeLength, prev.facadeHeight) : o,
      ),
    }));

  const addOpening = (kind: FacadeOpening["kind"]) =>
    setInput((prev) => ({
      ...prev,
      openings: [...prev.openings, createOpening(kind, prev.facadeLength, prev.facadeHeight)],
    }));

  const removeOpening = (id: string) =>
    setInput((prev) => ({ ...prev, openings: prev.openings.filter((o) => o.id !== id) }));

  const color = getSidingPanelColor(input.colorId);
  const hColor = getTrimColor(input, "hProfile");
  const jColor = getTrimColor(input, "jProfile");
  const jambColor = getTrimColor(input, "jamb");

  const setTrimColor = (part: SidingTrimPart, colorId: string) =>
    setInput((prev) => ({ ...prev, trimColors: { ...normalizeTrimColors(prev.trimColors), [part]: colorId } }));

  /* Печать: как на странице «Грильято» — системное окно печати открывается сразу, без новой вкладки */
  const handlePrint = () => {
    const ok = printSidingOverlay(calc, svgRef.current?.outerHTML ?? "", color.name);
    setPrintError(!ok);
  };

  return (
    <section
      id="calc"
      className={cn(
        "scroll-mt-[130px] py-12 lg:py-16",
        background === "white" ? "bg-white" : "bg-smoke",
      )}
    >
      <div className="mx-auto max-w-[1400px] px-4 lg:px-8">
        {/* БЛОК: Заголовок калькулятора «Расчёт ПВХ сайдинга» | ЗА ЧТО ОТВЕЧАЕТ: Шапка раздела расчёта | ОТКУДА ДАННЫЕ: Задано здесь | КАК ИЗМЕНИТЬ: Поменяйте текст внутри <div> и <h2> */}
        <motion.div
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, ease }}
          className="mb-8"
        >
          <div className="mb-2 text-[12.5px] font-extrabold uppercase tracking-[0.18em] text-graphite/45">
            Калькулятор · Фасад
          </div>
          <h2 className="text-[32px] font-black leading-[1.02] tracking-[-0.01em] lg:text-[46px]">
            Расчёт ПВХ сайдинга
          </h2>
        </motion.div>

        <div className="grid items-start gap-5 lg:grid-cols-[400px_minmax(0,1fr)] xl:grid-cols-[440px_minmax(0,1fr)]">
          {/* БЛОК: Левая колонка — размеры фасада, запас %, верхняя планка, края и редактор проёмов | ЗА ЧТО ОТВЕЧАЕТ: Все элементы ввода пользователя | ОТКУДА ДАННЫЕ: Состояние input | КАК ИЗМЕНИТЬ: Стандартные размеры добавляемых окон/дверей меняются в createOpening() в src/data/siding.ts */}
          <motion.div
            initial={{ opacity: 0, y: 26 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease }}
            className="space-y-6 rounded-3xl border border-line bg-white p-5 shadow-[0_2px_20px_rgba(20,25,27,0.05)] lg:p-6"
          >
            <div className="space-y-5">
              <SidingField
                label="Длина фасада"
                value={input.facadeLength}
                onChange={(v) => set("facadeLength", Math.max(0.5, v))}
                icon={MoveHorizontal}
              />
              <SidingField
                label="Высота фасада"
                value={input.facadeHeight}
                onChange={(v) => set("facadeHeight", Math.max(0.5, v))}
                icon={MoveVertical}
              />
            </div>

            {/* БЛОК: Ползунок и поле процентного запаса | ЗА ЧТО ОТВЕЧАЕТ: Добавляет выбранный процент запаса ко всем позициям таблицы | ОТКУДА ДАННЫЕ: input.sparePct | КАК ИЗМЕНИТЬ: Формула округления запаса задана в withSpare() в src/data/siding.ts */}
            <div>
              <div className="text-[13px] font-bold text-graphite/70 mb-2 flex items-center gap-1.5">
                <PackagePlus size={14} strokeWidth={2.4} className="text-graphite/40" />
                Запас
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="range" min={0} max={20} step={1} value={input.sparePct}
                  onChange={(e) => set("sparePct", parseInt(e.target.value, 10))}
                  aria-label="Запас, процентов"
                  className="pro-range flex-1"
                  style={{ "--fill": `${(input.sparePct / 20) * 100}%` } as React.CSSProperties}
                />
                <div className="flex items-center gap-1 shrink-0">
                  <input
                    value={String(input.sparePct)}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, "");
                      if (digits === "") {
                        set("sparePct", 0);
                        return;
                      }
                      const v = parseInt(digits, 10);
                      if (!Number.isNaN(v)) set("sparePct", Math.min(50, Math.max(0, v)));
                    }}
                    inputMode="numeric"
                    aria-label="Запас, процентов"
                    className="no-spin w-[64px] text-center text-[15px] font-extrabold bg-smoke rounded-lg px-2 py-1.5 outline-none border border-transparent focus:border-pro transition-colors tabular"
                  />
                  <span className="text-[13px] font-bold text-graphite/50">%</span>
                </div>
              </div>
              <div className="mt-2 text-[12px] text-graphite/50 font-medium">
                Добавляется к количеству всего рассчитываемого товара
              </div>
            </div>

            {/* БЛОК: Переключатель «Завершение сайдинга финишной планкой» | ЗА ЧТО ОТВЕЧАЕТ: Включает или выключает расчёт финишной планки по верхнему краю стены | ОТКУДА ДАННЫЕ: Поле input.straightTop | КАК ИЗМЕНИТЬ: Поменяйте подпись внутри <span> */}
            <button
              type="button"
              onClick={() => set("straightTop", !input.straightTop)}
              aria-pressed={input.straightTop}
              className={cn(
                "flex w-full items-center justify-between gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors",
                input.straightTop
                  ? "border-graphite bg-smoke"
                  : "border-line bg-smoke/60 hover:border-graphite/40",
              )}
            >
              <span className="block text-[13px] font-extrabold text-graphite">
                Завершение сайдинга финишной планкой
              </span>
              <span
                className={cn(
                  "relative h-6 w-11 shrink-0 rounded-full transition-colors",
                  input.straightTop ? "bg-graphite" : "bg-line",
                )}
              >
                <span
                  className={cn(
                    "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all",
                    input.straightTop ? "left-[22px]" : "left-0.5",
                  )}
                />
              </span>
            </button>

            {/* БЛОК: Выбор профилей для левой и правой стороны фасада | ЗА ЧТО ОТВЕЧАЕТ: J профиль, внутренний или наружный угол по краям стены | ОТКУДА ДАННЫЕ: Компонент EdgePicker выше | КАК ИЗМЕНИТЬ: Названия вариантов — в EDGE_OPTIONS */}
            <div className="space-y-4">
              <EdgePicker title="Левая сторона фасада" value={input.leftEdge} onChange={(v) => set("leftEdge", v)} />
              <EdgePicker title="Правая сторона фасада" value={input.rightEdge} onChange={(v) => set("rightEdge", v)} />
            </div>

            {/* БЛОК: Редактор проёмов «Окна и двери» | ЗА ЧТО ОТВЕЧАЕТ: Позволяет добавлять новые окна и двери, удалять их, задавать ширину, высоту, положение и тип обрамления («J профиль» или «Околооконная + финиш») | ОТКУДА ДАННЫЕ: Массив input.openings | КАК ИЗМЕНИТЬ: Размеры новых проёмов при добавлении задаются в createOpening() в src/data/siding.ts */}
            <div>
              <div className="mb-2.5 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-[13px] font-bold text-graphite/70">
                  <AppWindow size={14} strokeWidth={2.4} className="text-graphite/40" />
                  Окна и двери
                </div>
                <span className="rounded-lg bg-smoke px-2 py-0.5 text-[11.5px] font-bold text-graphite/60">
                  {input.openings.length} шт
                </span>
              </div>

              <div className="space-y-3">
                {input.openings.map((o, i) => (
                  <div key={o.id} className="rounded-2xl border border-line bg-smoke/40 p-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="grid h-7 w-7 place-items-center rounded-lg bg-graphite text-[13px] font-black text-white">
                          {openingLetter(i)}
                        </span>
                        <span className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-2.5 py-1.5 text-[11.5px] font-extrabold text-graphite">
                          {o.kind === "window" ? (
                            <AppWindow size={12} strokeWidth={2.4} className="text-graphite/45" />
                          ) : (
                            <DoorOpen size={12} strokeWidth={2.4} className="text-graphite/45" />
                          )}
                          {o.kind === "window" ? "Окно" : "Дверь"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => removeOpening(o.id)}
                          aria-label={`Удалить проём ${i + 1}`}
                          title="Удалить проём"
                          className="grid h-7 w-7 place-items-center rounded-lg border border-line bg-white text-graphite/50 transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 size={13} strokeWidth={2.4} />
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2.5">
                      <SidingField compact label="Ширина" value={o.width} onChange={(v) => patchOpening(o.id, { width: v })} />
                      <SidingField compact label="Высота" value={o.height} onChange={(v) => patchOpening(o.id, { height: v })} />
                      <SidingField compact label="От левого края" value={o.x} onChange={(v) => patchOpening(o.id, { x: v })} />
                      <SidingField compact label="От низа фасада" value={o.y} onChange={(v) => patchOpening(o.id, { y: v })} />
                    </div>

                    <div className="mt-3">
                      <div className="mb-1 text-[10.5px] font-bold uppercase tracking-wider text-graphite/45">
                        Обрамление проёма (3 стороны)
                      </div>
                      <div className="grid grid-cols-2 gap-1 rounded-xl bg-white p-1">
                        <button
                          type="button"
                          onClick={() => patchOpening(o.id, { trim: "j" })}
                          aria-pressed={o.trim === "j"}
                          className={cn(
                            "rounded-lg px-2 py-1.5 text-[11px] font-extrabold transition-colors",
                            o.trim === "j" ? "bg-graphite text-white" : "text-graphite/55 hover:text-graphite",
                          )}
                        >
                          J профиль
                        </button>
                        <button
                          type="button"
                          onClick={() => patchOpening(o.id, { trim: "jamb" })}
                          aria-pressed={o.trim === "jamb"}
                          className={cn(
                            "rounded-lg px-2 py-1.5 text-[11px] font-extrabold leading-tight transition-colors",
                            o.trim === "jamb" ? "bg-graphite text-white" : "text-graphite/55 hover:text-graphite",
                          )}
                        >
                          Околооконная + финиш
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => addOpening("window")}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-graphite/30 px-3 py-2.5 text-[12.5px] font-extrabold text-graphite/70 transition-colors hover:border-pro hover:bg-pro/10 hover:text-graphite"
                >
                  <Plus size={14} strokeWidth={2.6} />
                  Окно
                </button>
                <button
                  type="button"
                  onClick={() => addOpening("door")}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-graphite/30 px-3 py-2.5 text-[12.5px] font-extrabold text-graphite/70 transition-colors hover:border-pro hover:bg-pro/10 hover:text-graphite"
                >
                  <Plus size={14} strokeWidth={2.6} />
                  Дверь
                </button>
              </div>
            </div>

            {/* БЛОК: Цвета материалов и переключатель «Один цвет» | ОТКУДА ДАННЫЕ: SIDING_TRIM_PARTS и каталог SIDING_PRODUCTS | КАК ИЗМЕНИТЬ: Товары и доступные оттенки задаются в src/data/sidingCatalog.ts. Для общего цвета учитывается доступность у всех необходимых материалов. */}
            <div className="mt-6 border-t border-line pt-5">
              <div className="mb-2.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 text-[13px] font-bold text-graphite/70">
                  <Palette size={14} strokeWidth={2.4} className="text-graphite/40" />
                  Цвета
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={Boolean(input.singleColor)}
                  onClick={() => set("singleColor", !input.singleColor)}
                  className="inline-flex items-center gap-2 rounded-lg py-0.5 text-[12.5px] font-bold text-graphite/70 transition-colors hover:text-graphite focus:outline-none focus-visible:ring-2 focus-visible:ring-pro"
                >
                  Один цвет
                  <span
                    className={cn(
                      "relative h-5 w-9 shrink-0 rounded-full transition-colors",
                      input.singleColor ? "bg-graphite" : "bg-line",
                    )}
                  >
                    <span
                      className={cn(
                        "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all",
                        input.singleColor ? "left-[18px]" : "left-0.5",
                      )}
                    />
                  </span>
                </button>
              </div>

              <div className="space-y-1.5">
                {(input.singleColor
                  ? [
                      {
                        key: "all",
                        name: "Сайдинг целиком",
                        current: color,
                        colors: getAvailableSidingColors("panel"),
                        unused: false,
                        choose: (id: string) => set("colorId", id),
                      },
                    ]
                  : [
                      {
                        key: "siding",
                        name: "Сайдинг ПВХ",
                        current: color,
                        colors: getAvailableSidingColors("panel"),
                        unused: false,
                        choose: (id: string) => set("colorId", id),
                      },
                      ...SIDING_TRIM_PARTS.map((part) => ({
                        key: part.key as string,
                        name: part.name,
                        current: getTrimColor(input, part.key),
                        colors: getAvailableSidingColors(part.key),
                        unused: (calc.table.find((r) => r.key === SIDING_TRIM_ROW_KEYS[part.key])?.qty ?? 0) === 0,
                        choose: (id: string) => setTrimColor(part.key, id),
                      })),
                    ]
                ).map((row) => (
                  <div
                    key={row.key}
                    className="flex min-h-[69px] items-center justify-between gap-2 rounded-xl border border-line px-3 py-2 min-[375px]:min-h-[52px]"
                  >
                    <div className="min-w-0">
                      <div className="text-[12.5px] font-bold leading-snug">{row.name}</div>
                      <div className="text-[11px] font-semibold text-graphite/45">
                        {row.current.name}
                        {row.unused && " · не требуется"}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1 sm:gap-1.5" role="radiogroup" aria-label={`Цвет: ${row.name}`}>
                      {row.colors.map((c) => {
                        const active = row.current.id === c.id;
                        const unavailable = Boolean(input.singleColor && !unifiedColors.some((option) => option.id === c.id));
                        return (
                          <button
                            key={c.id}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            aria-label={`${row.name}: ${c.name}`}
                            title={unavailable ? `${c.name} — нет для всех необходимых материалов` : c.name}
                            disabled={unavailable}
                            onClick={() => row.choose(c.id)}
                            className={cn(
                              "h-5 w-5 rounded-full border border-graphite/15 transition-transform min-[360px]:h-6 min-[360px]:w-6",
                              unavailable ? "cursor-not-allowed opacity-30" : active ? "scale-110 ring-[3px] ring-pro" : "hover:scale-110",
                            )}
                            style={{ background: c.hex }}
                          />
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              {input.singleColor && (
                <p className="mt-2 text-[11px] leading-relaxed text-graphite/55">
                  Общий цвет доступен, когда он есть у всех необходимых материалов. Недоступные оттенки приглушены;
                  при изменении состава материалов выбранный цвет может смениться на белый.
                </p>
              )}
            </div>
          </motion.div>

          {/* БЛОК: Правая колонка — план фасада, список проёмов, раскрой и спецификация | ЗА ЧТО ОТВЕЧАЕТ: Показывает все результаты расчёта | ОТКУДА ДАННЫЕ: Объект calc из calcSiding() | КАК ИЗМЕНИТЬ: Каждый блок подписан ниже */}
          <div className="min-w-0 space-y-5">
            {/* БЛОК: Карточка «План фасада» с печатью, кликом на весь экран и списком проёмов | ЗА ЧТО ОТВЕЧАЕТ: Рисует схему стены и выводит под ней точные размеры и отступы всех проёмов от четырёх краёв фасада | ОТКУДА ДАННЫЕ: FacadeScheme и calc.openings | КАК ИЗМЕНИТЬ: Печатный шаблон настраивается в src/utils/printSidingLayout.ts */}
            <motion.div
              initial={{ opacity: 0, y: 26 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.1, ease }}
            >
              <div className="overflow-hidden rounded-2xl border border-line bg-white">
                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-line px-4 py-2.5 lg:px-5">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 text-[13px] font-extrabold">
                      <LayoutGrid size={15} strokeWidth={2.3} className="text-graphite/50" />
                      План фасада
                    </div>
                    <button
                      type="button"
                      onClick={handlePrint}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line bg-white px-3 text-[12px] font-bold text-graphite/75 transition-colors hover:border-graphite/50 hover:bg-smoke"
                    >
                      <Printer size={13} strokeWidth={2.5} />
                      Печать
                    </button>
                    {printError && (
                      <span role="alert" className="text-[11px] font-semibold text-red-600">
                        Не удалось подготовить лист печати
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11.5px] font-semibold text-graphite/55">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2.5 w-4 rounded-sm border" style={{ background: color.scheme.trim, borderColor: color.scheme.trimEdge }} /> стартовая планка
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-2.5 w-4 rounded-sm border border-dashed" style={{ background: hColor.scheme.trim, borderColor: hColor.scheme.seam }} /> стык панелей (H)
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span
                        className="h-2.5 w-4 rounded-sm border"
                        style={{
                          background: jambColor.id === "white" ? "#fff" : jambColor.scheme.trim,
                          borderColor: jambColor.id === "white" ? "#98a6b5" : jambColor.scheme.trimEdge,
                        }}
                      /> околооконная
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-2.5 w-4 rounded-sm border" style={{ background: jColor.scheme.trim, borderColor: jColor.scheme.trimEdge }} /> J профиль
                    </span>
                  </div>
                </div>

                <div className="relative p-3">
                  <button
                    type="button"
                    onClick={() => setPlanZoomed(true)}
                    title="Открыть план на весь экран"
                    aria-label="Открыть план фасада на весь экран"
                    className="group/plan relative block w-full cursor-zoom-in overflow-x-auto text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-pro"
                  >
                    <FacadeScheme calc={calc} input={input} svgRef={svgRef} />
                    <PlanZoomHint className="group-hover/plan:opacity-100 group-focus-visible/plan:opacity-100" />
                  </button>
                </div>

                {calc.openings.length > 0 && (
                  <div className="border-t border-line px-4 py-3 lg:px-5">
                    <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-graphite/45">
                      Проёмы: размеры и положение
                    </div>
                    <ul className="grid gap-x-6 gap-y-1.5 md:grid-cols-2">
                      {calc.openings.map((o, i) => (
                        <li key={o.id} className="flex items-start gap-2 text-[12.5px] leading-relaxed text-graphite/70">
                          <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded bg-graphite text-[11px] font-black text-pro">
                            {openingLetter(i)}
                          </span>
                          <span>
                            <b className="text-graphite">
                              {o.kind === "window" ? "Окно" : "Дверь"} · {m2(o.width)} × {m2(o.height)} м
                            </b>{" "}
                            · от левого края {m2(o.x)} м · от правого края {m2(calc.L / 1000 - o.x - o.width)} м · от
                            низа {m2(o.y)} м · до верха {m2(calc.H / 1000 - o.y - o.height)} м ·{" "}
                            {o.trim === "jamb" ? "околооконная планка + финишная" : "J профиль"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

              </div>
            </motion.div>

            {/* БЛОК: Ведомость «Раскрой панелей» со сворачиванием | ЗА ЧТО ОТВЕЧАЕТ: Перечисляет панели, обрезки которых использованы повторно; по умолчанию свёрнута, разворачивается кнопкой справа | ОТКУДА ДАННЫЕ: Массив calc.panelPlan из src/data/siding.ts | КАК ИЗМЕНИТЬ: Стартовое состояние задаётся в useState(false) у cutPlanOpen */}
            {(() => {
              const reused = calc.panelPlan.filter((p) => p.items.length > 1);
              const wasteTotal = calc.panelPlan.reduce((sum, p) => sum + p.wasteMm, 0);
              if (reused.length === 0) return null;
              return (
                <motion.div
                  initial={{ opacity: 0, y: 26 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.7, delay: 0.12, ease }}
                  className="overflow-hidden rounded-2xl border border-line bg-white shadow-[0_2px_20px_rgba(20,25,27,0.04)]"
                >
                  <div
                    className={cn(
                      "flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 lg:px-5",
                      cutPlanOpen && "border-b border-line",
                    )}
                  >
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="text-[15px] font-extrabold">Раскрой панелей</div>
                      <div className="text-[12px] font-semibold text-graphite/50">
                        обрезки {reused.length} панелей использованы повторно · остаток всего {m2(wasteTotal / 1000)} м
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCutPlanOpen((v) => !v)}
                      aria-expanded={cutPlanOpen}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line bg-white px-3 text-[12px] font-bold text-graphite/75 transition-colors hover:border-graphite/50 hover:bg-smoke"
                    >
                      {cutPlanOpen ? "Свернуть" : "Развернуть"}
                      <ChevronDown
                        size={14}
                        strokeWidth={2.6}
                        className={cn("transition-transform duration-300", cutPlanOpen && "rotate-180")}
                      />
                    </button>
                  </div>
                  {cutPlanOpen && (
                    <div className="thin-scroll max-h-[260px] overflow-y-auto px-4 py-3 lg:px-5">
                      <ul className="space-y-1.5">
                        {reused.map((p) => (
                          <li key={p.panel} className="text-[12.5px] leading-relaxed text-graphite/70">
                            <b className="text-graphite">Панель {p.panel}:</b>{" "}
                            {p.items
                              .map(
                                (it) =>
                                  `${it.label} — ${m2(it.lenMm / 1000)} м · ряд ${it.row + 1} · от ${m2(it.x0 / 1000)} до ${m2(it.x1 / 1000)} м${it.near ? ` · ${it.near}` : ""}`,
                              )
                              .join("; ")}
                            {p.wasteMm > 0 ? ` · остаток ${m2(p.wasteMm / 1000)} м` : " · без остатка"}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </motion.div>
              );
            })()}

            {/* БЛОК: Итоговая таблица «Спецификация материалов» | ОТКУДА ДАННЫЕ: specRows; товары и артикулы — в sidingCatalog.ts, цены — в Google-таблице. */}
            <motion.div
              initial={{ opacity: 0, y: 26 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.14, ease }}
              className="overflow-hidden rounded-2xl border border-line bg-white shadow-[0_2px_20px_rgba(20,25,27,0.04)]"
            >
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-line px-4 py-3.5 lg:px-5">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="text-[15px] font-extrabold">Спецификация материалов</span>
                  <span className="rounded-lg bg-smoke px-2 py-0.5 text-[11.5px] font-bold tabular text-graphite/60">
                    {specRows.length} поз.
                  </span>
                  {specSkipped > 0 && (
                    <span
                      className="text-[11.5px] font-semibold text-graphite/40"
                      title={`${specSkipped} элемент(ов) не нужны для этого фасада и в спецификацию не входят`}
                    >
                      {specSkipped} не требуется — скрыто
                    </span>
                  )}
                </div>
                <div className="text-[12px] font-semibold text-graphite/50" aria-live="polite">
                  {priceStatus === "live" ? "Цены из Google-таблицы" : priceStatus === "loading" ? "Загружаем цены…" : "Нет связи с таблицей · сохранённые цены"}
                </div>
              </div>
              {specMissing > 0 && (
                <div className="border-b border-amber-100 bg-amber-50 px-4 py-2 text-[12.5px] font-semibold text-amber-900 lg:px-5">
                  Для {specMissing} поз. нет цены — их стоимость не включена в итог.
                </div>
              )}
              <div className="thin-scroll overflow-x-auto">
                <table className="w-full min-w-[720px] text-[13.5px]">
                  <thead>
                    <tr className="border-b border-line text-left text-[11px] uppercase tracking-wider text-graphite/45">
                      <th className="px-4 py-2.5 font-bold lg:px-5">Артикул</th>
                      <th className="px-3 py-2.5 font-bold">Наименование</th>
                      <th className="px-3 py-2.5 text-right font-bold">Кол-во</th>
                      <th className="px-3 py-2.5 text-right font-bold">Цена, ₽</th>
                      <th className="px-4 py-2.5 text-right font-bold lg:px-5">Сумма, ₽</th>
                    </tr>
                  </thead>
                  <tbody>
                    {specRows.map((r, i) => (
                      <tr key={r.key} className={cn("border-b border-line/70", i % 2 === 1 && "bg-smoke/60")}>
                        <td className="whitespace-nowrap px-4 py-3 font-bold tabular lg:px-5">
                          <ArticleCell art={r.art} url={r.url} />
                        </td>
                        <td className="px-3 py-3 font-semibold text-graphite/90">
                          {r.name}
                          <span className="block text-[11.5px] font-medium text-graphite/45">{r.size}</span>
                        </td>
                        <td className="px-3 py-3 text-right font-bold tabular">
                          {fmt.format(r.qty)} <span className="font-semibold text-graphite/40">шт</span>
                        </td>
                        <td className="px-3 py-3 text-right tabular text-graphite/70">
                          {r.missing ? <span className="font-bold text-red-600">нет цены</span> : fmtPrice(r.price)}
                        </td>
                        <td className="px-4 py-3 text-right font-extrabold tabular lg:px-5">
                          {r.missing ? <span className="text-red-600">нет цены</span> : fmtPrice(r.sum)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-graphite text-white">
                      <td className="px-4 py-3.5 text-[12px] font-extrabold uppercase tracking-widest lg:px-5" colSpan={3}>
                        Итого материалы
                      </td>
                      <td
                        colSpan={2}
                        className="whitespace-nowrap px-4 py-3.5 text-right text-[40px] font-black leading-none text-pro tabular lg:px-5"
                      >
                        {fmt.format(Math.round(specTotal))} <span className="text-[24px]">₽</span>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* БЛОК: Модальное окно полноэкранного просмотра плана фасада | ЗА ЧТО ОТВЕЧАЕТ: Открывается при клике на чертёж плана | ОТКУДА ДАННЫЕ: SidingPlanLightbox.tsx | КАК ИЗМЕНИТЬ: В файле src/components/SidingPlanLightbox.tsx */}
      {planZoomed && (
        <SidingPlanLightbox
          calc={calc}
          input={input}
          svg={svgRef.current?.outerHTML ?? ""}
          onClose={() => setPlanZoomed(false)}
        />
      )}
    </section>
  );
}
