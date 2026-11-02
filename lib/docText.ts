import mammoth from "mammoth";
import readXlsxFile, { readSheetNames } from "read-excel-file";
import { docxHtmlToText } from "./docxHtml";

export interface Doc {
  name: string;
  text: string;
}

export const DOC_ACCEPT = ".docx,.xlsx,.txt,.md,.csv";
export const isSupportedDoc = (name: string) => /\.(docx|xlsx|txt|md|csv)$/i.test(name);

async function docxToText(file: File): Promise<string> {
  const { value } = await mammoth.convertToHtml(
    { arrayBuffer: await file.arrayBuffer() },
    { convertImage: mammoth.images.imgElement(async () => ({ src: "" })) },
  );
  return docxHtmlToText(value);
}

async function xlsxToText(file: File): Promise<string> {
  const parts: string[] = [];
  for (const sheet of await readSheetNames(file)) {
    const rows = await readXlsxFile(file, { sheet });
    const lines = rows
      .map((r) => r.map((c) => (c instanceof Date ? c.toISOString().slice(0, 10) : String(c ?? "").replace(/\s+/g, " ").trim())).join(" | "))
      .filter((l) => l.replace(/[|\s]/g, ""));
    parts.push(lines.join("\n"));
  }
  return parts.join("\n\n");
}

/** Читає звіт у браузері: файл нікуди не надсилається. */
export async function readDoc(file: File): Promise<Doc> {
  const name = file.name.toLowerCase();
  let text: string;
  if (name.endsWith(".docx")) text = await docxToText(file);
  else if (name.endsWith(".xlsx")) text = await xlsxToText(file);
  else if (/\.(txt|md|csv)$/.test(name)) text = await file.text();
  else throw new Error(`Формат файлу "${file.name}" не підтримується.`);
  return { name: file.name, text };
}
