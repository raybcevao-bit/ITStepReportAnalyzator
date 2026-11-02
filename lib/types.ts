export type Cell = string | number | boolean | Date | null;
export type RawRow = Record<string, Cell>;

export interface Table {
  fileName: string;
  headers: string[];
  rows: RawRow[];
}

export interface DatasetSchema {
  dateCol: string;
  entityCol: string;
  metricCols: string[];
  textCol: string | null;
  /** Метрики, де менше значення означає кращий результат (скарги, помилки). */
  lowerIsBetter: string[];
}
