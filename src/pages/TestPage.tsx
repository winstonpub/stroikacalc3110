/* ============================================================================
 * ФАЙЛ: src/pages/TestPage.tsx — Тестовая страница (#/test)
 * ЗА ЧТО ОТВЕЧАЕТ: Выводит заглушку «Тестовая страница» вместо калькулятора (код самого калькулятора сохранён в компонентах и других страницах).
 * ОТКУДА БЕРЁТ ИНФОРМАЦИЮ: Использует общий компонент SiteFooter для нижнего блока сайта.
 * КАК ИЗМЕНИТЬ: Чтобы вернуть калькулятор на эту страницу, замените блок-заглушку ниже на <SidingCalculator /> (импорт из ../components/SidingCalculator) или на любой другой калькулятор сайта.
 * ========================================================================= */

import { SquarePen } from "lucide-react";
import SiteFooter from "../components/SiteFooter";

/* БЛОК: Заглушка «Тестовая страница» | ЗА ЧТО ОТВЕЧАЕТ: Центрированная карточка с надписью, сообщающая, что раздел в разработке | ОТКУДА ДАННЫЕ: Текст задан прямо в этом файле | КАК ИЗМЕНИТЬ: Поменяйте текст внутри <h1> или добавьте нужный компонент вместо карточки */
function TestPlaceholder() {
  return (
    <section className="flex min-h-[55vh] items-center justify-center bg-smoke px-4 py-16 lg:py-24">
      <div className="w-full max-w-[760px] rounded-3xl border border-line bg-white px-6 py-14 text-center shadow-[0_2px_20px_rgba(20,25,27,0.04)] lg:px-12">
        <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-pro text-graphite">
          <SquarePen size={26} strokeWidth={2.3} aria-hidden="true" />
        </div>
        <h1 className="text-[32px] font-black leading-[1.05] tracking-[-0.01em] text-graphite lg:text-[42px]">
          Тестовая страница
        </h1>
        <p className="mx-auto mt-4 max-w-[520px] text-[14px] leading-relaxed text-graphite/60">
          Раздел временно не показывает содержимое и готовится к публикации.
        </p>
      </div>
    </section>
  );
}

/* БЛОК: Компонент страницы «Тест» (TestPage) | ЗА ЧТО ОТВЕЧАЕТ: Выводит заглушку и общий подвал сайта | ОТКУДА ДАННЫЕ: SiteFooter | КАК ИЗМЕНИТЬ: Подключение/удаление калькулятора выполняется в этом файле */
export default function TestPage() {
  return (
    <>
      <TestPlaceholder />
      <SiteFooter />
    </>
  );
}
