/* ============================================================================
 * ФАЙЛ: src/pages/TestSmetaPage.tsx — Тестовая спецификация материалов (#/smeta-test)
 * ЗА ЧТО ОТВЕЧАЕТ: Выводит заглушку «Спецификация тестовой страницы» вместо таблицы сметы. Печать спецификаций выполняется прямо из калькуляторов «Грильято» и «Армстронг».
 * ОТКУДА БЕРЁТ ИНФОРМАЦИЮ: Использует общий компонент SiteFooter для нижнего блока сайта.
 * КАК ИЗМЕНИТЬ: Чтобы вернуть на страницу полноценную смету, замените блок-заглушку ниже на компоненты из src/components/SpecSheet.tsx или используйте её как шаблон новой спецификации.
 * ========================================================================= */

import { FileSpreadsheet } from "lucide-react";
import SiteFooter from "../components/SiteFooter";

/* БЛОК: Заглушка «Спецификация тестовой страницы» | ЗА ЧТО ОТВЕЧАЕТ: Центрированная карточка с надписью вместо таблицы материалов | ОТКУДА ДАННЫЕ: Текст задан прямо в этом файле | КАК ИЗМЕНИТЬ: Поменяйте текст внутри <h1> или верните сюда таблицу спецификации */
function TestSmetaPlaceholder() {
  return (
    <section className="flex min-h-[55vh] items-center justify-center bg-smoke px-4 py-16 lg:py-24">
      <div className="w-full max-w-[760px] rounded-3xl border border-line bg-white px-6 py-14 text-center shadow-[0_2px_20px_rgba(20,25,27,0.04)] lg:px-12">
        <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-pro text-graphite">
          <FileSpreadsheet size={26} strokeWidth={2.3} aria-hidden="true" />
        </div>
        <h1 className="text-[32px] font-black leading-[1.05] tracking-[-0.01em] text-graphite lg:text-[42px]">
          Спецификация тестовой страницы
        </h1>
        <p className="mx-auto mt-4 max-w-[520px] text-[14px] leading-relaxed text-graphite/60">
          Раздел временно не показывает таблицу материалов и готовится к публикации.
        </p>
      </div>
    </section>
  );
}

/* БЛОК: Компонент тестовой страницы спецификации (TestSmetaPage) | ЗА ЧТО ОТВЕЧАЕТ: Выводит заглушку и общий подвал сайта | ОТКУДА ДАННЫЕ: SiteFooter | КАК ИЗМЕНИТЬ: Подключение спецификации выполняется в этом файле */
export default function TestSmetaPage() {
  return (
    <>
      <TestSmetaPlaceholder />
      <SiteFooter />
    </>
  );
}
