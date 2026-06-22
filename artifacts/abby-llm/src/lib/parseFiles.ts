/**
 * Парсер ответов языковой модели в реальные файлы проекта.
 *
 * Когда Abby (Qwen) генерирует сайт/приложение, она выдаёт markdown с блоками
 * кода. Этот модуль превращает такой ответ в набор файлов {name, language,
 * content}, чтобы показать их в Explorer, открыть в редакторе и собрать Preview —
 * как в Replit.
 */

import type { AgentFile } from "./api";

export interface ParsedProject {
  files: AgentFile[];
  projectName: string;
  previewFile: string | null;
  /** Текст ответа без блоков кода (пояснения модели), может быть пустым. */
  prose: string;
}

const EXT_LANG: Record<string, string> = {
  html: "html",
  htm: "html",
  css: "css",
  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  jsx: "javascript",
  ts: "typescript",
  tsx: "typescript",
  json: "json",
  md: "markdown",
  py: "python",
  txt: "plaintext",
  svg: "xml",
  xml: "xml",
};

const LANG_DEFAULT_NAME: Record<string, string> = {
  html: "index.html",
  css: "style.css",
  javascript: "script.js",
  js: "script.js",
  typescript: "script.ts",
  ts: "script.ts",
  jsx: "App.jsx",
  tsx: "App.tsx",
  json: "data.json",
  python: "main.py",
  py: "main.py",
  markdown: "README.md",
  md: "README.md",
};

function langFromExt(ext: string): string {
  return EXT_LANG[ext.toLowerCase()] ?? "plaintext";
}

/** Достаёт имя файла из инфо-строки блока: ```html index.html / ```html:index.html / ```html filename=index.html */
function nameFromInfo(info: string): string | null {
  const trimmed = info.trim();
  if (!trimmed) return null;
  // filename=... / name=... / title=...
  const kv = trimmed.match(/(?:file|filename|name|title)\s*[=:]\s*["'`]?([\w./-]+\.[a-z0-9]+)/i);
  if (kv) return kv[1];
  // ```html:index.html
  const colon = trimmed.match(/[:\s]([\w./-]+\.[a-z0-9]+)\s*$/i);
  if (colon) return colon[1];
  // голое имя файла как инфо-строка: ```index.html
  const bare = trimmed.match(/^([\w./-]+\.[a-z0-9]+)$/);
  if (bare) return bare[1];
  return null;
}

/** Ищет имя файла в тексте перед блоком кода (markdown-заголовки, "Создание файла `x`", **x**). */
function nameFromContext(before: string): string | null {
  // последние ~240 символов до блока — самое релевантное
  const tail = before.slice(-240);
  // явное упоминание файла рядом со словом "файл"/"file"
  const fileWord = tail.match(
    /(?:файл[а-я]*|file|filename|создани[ея]\s+файла|создать\s+файл)\s*[:`*\s-]*["'`*]*([\w./-]+\.[a-z0-9]+)/i,
  );
  if (fileWord) return fileWord[1];
  // любое имя файла в обратных кавычках на последних строках
  const backtick = [...tail.matchAll(/`([\w./-]+\.[a-z0-9]+)`/g)];
  if (backtick.length) return backtick[backtick.length - 1][1];
  // жирным/в заголовке: **index.html** или ## index.html
  const bold = [...tail.matchAll(/(?:\*\*|#+\s*)([\w./-]+\.[a-z0-9]+)/g)];
  if (bold.length) return bold[bold.length - 1][1];
  return null;
}

/**
 * Разбирает ответ модели в проект из файлов.
 * Возвращает пустой files[], если в ответе нет ни одного блока кода с кодом-проектом.
 */
export function parseProject(raw: string, prompt = ""): ParsedProject {
  const files: AgentFile[] = [];
  const usedNames = new Set<string>();
  const fenceRe = /```([^\n`]*)\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;
  let lastIndex = 0;
  const proseParts: string[] = [];
  let blockIdx = 0;

  while ((match = fenceRe.exec(raw)) !== null) {
    const info = match[1] ?? "";
    const code = (match[2] ?? "").replace(/\s+$/, "");
    const before = raw.slice(lastIndex, match.index);
    proseParts.push(before);
    lastIndex = fenceRe.lastIndex;

    if (!code.trim()) continue;

    // 1) имя из инфо-строки, 2) из контекста перед блоком, 3) по языку
    let name = nameFromInfo(info) ?? nameFromContext(before);
    const infoLang = info.trim().split(/[\s:]/)[0]?.toLowerCase() ?? "";

    if (!name) {
      const lang = infoLang || guessLangFromCode(code);
      name = LANG_DEFAULT_NAME[lang] ?? `file${blockIdx > 0 ? blockIdx : ""}.txt`;
    }

    // нормализуем путь
    name = name.replace(/^\.?\//, "").trim();

    // дедуп
    if (usedNames.has(name)) {
      const dot = name.lastIndexOf(".");
      const base = dot > 0 ? name.slice(0, dot) : name;
      const ext = dot > 0 ? name.slice(dot) : "";
      let n = 2;
      while (usedNames.has(`${base}-${n}${ext}`)) n++;
      name = `${base}-${n}${ext}`;
    }
    usedNames.add(name);

    const ext = name.split(".").pop() ?? "txt";
    files.push({ name, language: langFromExt(ext), content: code });
    blockIdx++;
  }
  proseParts.push(raw.slice(lastIndex));

  const previewFile =
    files.find((f) => /(^|\/)index\.html$/i.test(f.name))?.name ??
    files.find((f) => /\.html$/i.test(f.name))?.name ??
    null;

  return {
    files,
    projectName: inferProjectName(prompt),
    previewFile,
    prose: proseParts.join("").replace(/\n{3,}/g, "\n\n").trim(),
  };
}

function guessLangFromCode(code: string): string {
  if (/<!DOCTYPE html|<html|<head|<body/i.test(code)) return "html";
  if (/^\s*[.#@][\w-]+\s*\{|:\s*[^;]+;|@media|@keyframes/m.test(code) && !/function|=>/.test(code))
    return "css";
  if (/^\s*\{[\s\S]*\}\s*$/.test(code.trim()) && /"\w+"\s*:/.test(code)) return "json";
  if (/import .* from|export |const |let |function |=>/.test(code)) return "javascript";
  return "plaintext";
}

/** Короткий, чистый слаг названия проекта по запросу пользователя. */
export function inferProjectName(prompt: string): string {
  const p = prompt.toLowerCase();
  const map: [RegExp, string][] = [
    [/портфолио|portfolio/, "portfolio"],
    [/лендинг|landing/, "landing-page"],
    [/дашборд|дашбор|dashboard|аналитик/, "dashboard"],
    [/todo|туду|задач/, "todo-app"],
    [/игр|game|змейк|snake|тетрис|tetris/, "game"],
    [/магазин|shop|store|ecommerce|интернет-магазин/, "shop"],
    [/блог|blog/, "blog"],
    [/сайт|site|website|web/, "website"],
    [/приложени|app|апп/, "app"],
  ];
  for (const [re, name] of map) if (re.test(p)) return name;
  return "abby-project";
}

/**
 * Инструкция для Qwen: выдать рабочий проект отдельными файлами, чтобы парсер
 * мог надёжно их извлечь. Подставляется перед запросом пользователя.
 */
export function buildPrompt(userRequest: string): string {
  return [
    "Ты — Abby, ИИ-разработчик уровня Replit. Создай ПОЛНОСТЬЮ рабочий проект по запросу пользователя.",
    "",
    "Строгие правила вывода:",
    "1. Выведи КАЖДЫЙ файл отдельным блоком кода Markdown.",
    "2. В первой строке блока после языка укажи ИМЯ ФАЙЛА. Формат строго такой:",
    "```html index.html",
    "...код...",
    "```",
    "```css style.css",
    "...код...",
    "```",
    "```js script.js",
    "...код...",
    "```",
    "3. Используй относительные пути: подключай style.css и script.js в index.html.",
    "4. Делай красивый, современный, адаптивный дизайн и реально работающий код.",
    "5. Пиши минимум пояснений вне блоков кода — только сами файлы.",
    "",
    `Запрос пользователя: ${userRequest}`,
  ].join("\n");
}
