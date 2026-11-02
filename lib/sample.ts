import type { Table } from "./types";

// Демо-набір: 10 менеджерів, 10 тижнів щотижневих звітів. Цифри згенеровані, не реальні.
const PEOPLE = [
  { name: "Олена Гринчук", base: 1.25, drift: 0.01 },
  { name: "Тарас Мельник", base: 1.05, drift: 0.03 },
  { name: "Ірина Савчук", base: 0.95, drift: 0.0 },
  { name: "Богдан Коваль", base: 0.85, drift: -0.035 },
  { name: "Мар'яна Ткачук", base: 1.1, drift: 0.015 },
  { name: "Остап Левицький", base: 0.75, drift: 0.045 },
  { name: "Наталія Бондар", base: 1.0, drift: -0.01 },
  { name: "Дмитро Паламарчук", base: 0.9, drift: 0.0 },
  { name: "Софія Литвин", base: 1.15, drift: 0.02 },
  { name: "Андрій Кравець", base: 0.8, drift: -0.02 },
];

const COMMENTS = [
  "Багато повторних дзвінків, частина лідів не відповідає після першого контакту.",
  "Провела дві зустрічі з батьками, домовились про пробний урок на наступному тижні.",
  "Затримка з оплатами у двох клієнтів, нагадування надіслані.",
  "CRM гальмувала у вівторок, частину дзвінків вносив вручну.",
  "Новий скрипт для холодних дзвінків працює краще, конверсія росте.",
  "Хворів два дні, план не виконаний.",
  "Отримала скаргу щодо розкладу груп, передала адміністратору.",
  "Закрив велику корпоративну угоду на навчання 12 співробітників.",
];

export function sampleTable(): Table {
  let seed = 7;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  const noise = (k: number) => 1 + (rand() - 0.5) * k;

  const weeks = 10;
  const start = new Date(Date.UTC(2026, 7, 31)); // понеділок
  const rows: Table["rows"] = [];

  for (let w = 0; w < weeks; w++) {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + w * 7 + 4); // звіт у п'ятницю
    const iso = date.toISOString().slice(0, 10);
    PEOPLE.forEach((p, i) => {
      // Останній тиждень: одна людина не здала звіт.
      if (w === weeks - 1 && p.name === "Наталія Бондар") return;
      const f = p.base * (1 + p.drift * w) * noise(0.25);
      let calls = Math.round(110 * f);
      let deals = Math.max(0, Math.round(9 * f * noise(0.5)));
      let complaints = Math.max(0, Math.round((2.4 - f) * noise(1.2)));
      // Аномалії останнього тижня для демонстрації.
      if (w === weeks - 1 && p.name === "Остап Левицький") deals += 9;
      if (w === weeks - 1 && p.name === "Богдан Коваль") {
        calls = Math.round(calls * 0.35);
        complaints += 4;
      }
      const meetings = Math.round(calls * 0.14 * noise(0.4));
      const conversion = calls ? Math.round((deals / calls) * 1000) / 10 : 0;
      rows.push({
        "Дата": iso,
        "Співробітник": p.name,
        "Дзвінки": calls,
        "Зустрічі": meetings,
        "Продажі": deals,
        "Виручка, грн": Math.round(deals * 8400 * noise(0.3)),
        "Конверсія, %": conversion,
        "Скарги": complaints,
        "Коментар": rand() < 0.45 ? COMMENTS[(i + w) % COMMENTS.length] : "",
      });
    });
  }

  return {
    fileName: "Демо-дані (10 тижнів)",
    headers: ["Дата", "Співробітник", "Дзвінки", "Зустрічі", "Продажі", "Виручка, грн", "Конверсія, %", "Скарги", "Коментар"],
    rows,
  };
}
