const BLOB = "absolute rounded-full blur-[120px]";
const BLUE = "bg-primary/25 dark:bg-primary/30";
const ORANGE = "bg-orange-accent/20 dark:bg-orange-accent/25";

/**
 * Свечение по всей высоте страницы: 6 размытых пятен, чередуются Electric Blue / Cantaloupe Orange
 * и левый / правый край. Слой растянут на всю обёртку (inset-0) и обрезан (overflow-hidden),
 * pointer-events-none — не перехватывает клики.
 * Родитель должен быть `relative isolate`: тогда z-[-10] — над фоном body (с текстурой), но под контентом.
 */
export function BackgroundGlow() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-[-10] overflow-hidden">
      <div className={`${BLOB} ${BLUE} top-[-10%] left-[-10%] size-[34rem]`} />
      <div className={`${BLOB} ${ORANGE} top-[6%] right-[-12%] size-[30rem]`} />
      <div className={`${BLOB} ${ORANGE} top-[28%] left-[-14%] size-[28rem]`} />
      <div className={`${BLOB} ${BLUE} top-[46%] right-[-8%] size-[32rem]`} />
      <div className={`${BLOB} ${BLUE} top-[66%] left-[-8%] size-[30rem]`} />
      <div className={`${BLOB} ${ORANGE} bottom-[-5%] right-[-5%] size-[34rem]`} />
    </div>
  );
}
