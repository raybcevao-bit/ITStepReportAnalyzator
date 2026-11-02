// Перетворення HTML від mammoth у текст для аналізатора. Без залежностей, працює і в браузері, і в Node.

export function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, "&");
}

const stripTags = (s: string) => decodeEntities(s.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

/**
 * Рядки таблиць із даними (3+ короткі комірки, напр. "Показник | Значення | Одиниця") зводимо в один рядок.
 * Великі комірки-контейнери, якими розмічено рев'ю, не чіпаємо: у них цілі розділи звіту.
 */
export function compactDataRows(html: string): string {
  return html.replace(/<tr>((?:(?!<tr>|<\/tr>)[\s\S])*)<\/tr>/g, (row, inner: string) => {
    const cells = [...inner.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map((m) => stripTags(m[1]));
    const isData = cells.length >= 3 && cells.every((c) => c.length < 100) && !cells.some((c) => /досягнення|проблеми|плани/i.test(c));
    return isData ? `<p>${cells.map((c) => c.replace(/\|/g, "/")).join(" | ")}</p>` : row;
  });
}

/** Текст .docx зі збереженням таблиць: комірки через " | ", рядок таблиці на рядок. */
export function docxHtmlToText(rawHtml: string): string {
  return decodeEntities(
    compactDataRows(rawHtml)
      .replace(/<img[^>]*>/g, "")
      .replace(/<\/(td|th)>/g, " | ")
      .replace(/<\/tr>/g, "\n")
      .replace(/<li>/g, "- ")
      .replace(/<\/(p|li|h[1-6]|table)>|<br\s*\/?>/g, "\n")
      .replace(/<[^>]+>/g, ""),
  )
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
