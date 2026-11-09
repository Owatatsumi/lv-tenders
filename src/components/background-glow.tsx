/**
 * Каждое пятно: -z-10 и pointer-events-none — даже если слой-контейнер когда-нибудь поменяют,
 * пятна не перекроют клики по карточкам, поиску и кнопкам.
 */
const BLOB = "pointer-events-none absolute -z-10 rounded-full blur-[120px]";
const BLUE = "bg-primary/25 dark:bg-primary/30";
const ORANGE = "bg-orange-accent/20 dark:bg-orange-accent/25";
// Пятна в центре лежат прямо под карточками — чуть мягче, чтобы не спорить с текстом
const BLUE_SOFT = "bg-primary/20 dark:bg-primary/25";
const ORANGE_SOFT = "bg-orange-accent/15 dark:bg-orange-accent/20";

/**
 * Свечение по всей площади страницы: 9 размытых пятен Electric Blue / Cantaloupe Orange
 * в «случайном» порядке — по краям и крупные по центру, чтобы просвечивали сквозь стеклянные карточки.
 * Позиции в процентах от высоты страницы, поэтому разброс сохраняется при любой длине списка.
 * Слой растянут на всю обёртку (inset-0) и обрезан (overflow-hidden) — без горизонтального скролла.
 * Родитель должен быть `relative isolate`: тогда z-[-10] — над фоном body (с текстурой), но под контентом.
 */
export function BackgroundGlow() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-[-10] overflow-hidden">
      {/* верх: углы */}
      <div className={`${BLOB} ${BLUE} top-[-8%] left-[-10%] size-[34rem]`} />
      <div className={`${BLOB} ${ORANGE} top-[3%] right-[-8%] size-[28rem]`} />
      {/* центр, под первыми рядами карточек */}
      <div className={`${BLOB} ${BLUE_SOFT} top-[16%] left-1/2 size-[40rem] -translate-x-1/2`} />
      <div className={`${BLOB} ${ORANGE} top-[34%] left-[14%] size-[26rem]`} />
      <div className={`${BLOB} ${BLUE} top-[42%] right-[10%] size-[24rem]`} />
      {/* центр, середина списка */}
      <div className={`${BLOB} ${ORANGE_SOFT} top-[55%] left-[45%] size-[38rem] -translate-x-1/2`} />
      <div className={`${BLOB} ${BLUE} top-[70%] left-[-6%] size-[30rem]`} />
      <div className={`${BLOB} ${ORANGE} top-[80%] right-[-4%] size-[30rem]`} />
      {/* низ, чуть правее центра */}
      <div className={`${BLOB} ${BLUE_SOFT} bottom-[-8%] left-[58%] size-[34rem] -translate-x-1/2`} />
    </div>
  );
}
