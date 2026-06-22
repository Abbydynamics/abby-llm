/**
 * Abby Design System — базовая дизайн-система для проектов, которые генерирует Qwen.
 *
 * Зачем: небольшая локальная модель часто пишет слабый CSS, и «готовые продукты»
 * выглядят бедно. Мы автоматически подключаем этот файл ПЕРВЫМ в каждый
 * сгенерированный проект. Он стилизует «голые» HTML-элементы (типографика,
 * кнопки, поля, карточки, таблицы) на премиальном уровне и даёт дизайн-токены
 * (var(--abby-*)) и лёгкие утилиты (.container/.card/.grid/.gradient-text).
 *
 * Все селекторы — низкой специфичности (элементы + одиночные классы, без
 * !important), поэтому собственный style.css модели всегда переопределяет базу.
 */

import type { AgentFile } from "./api";

export const ABBY_THEME_FILE = "abby-theme.css";

export const ABBY_THEME_CSS = `/* Abby Design System — базовая тема. Подключается первой; ваш style.css её переопределяет. */
:root{
  --abby-bg:#0a0a14; --abby-bg-2:#0e0e1c;
  --abby-surface:#13131f; --abby-surface-2:#1b1b2e;
  --abby-text:#ececf7; --abby-muted:#9a9ac0; --abby-border:rgba(255,255,255,.09);
  --abby-primary:#8b5cf6; --abby-primary-2:#c084fc; --abby-accent:#ec4899;
  --abby-success:#22c55e; --abby-danger:#ef4444;
  --abby-radius:16px; --abby-radius-sm:10px;
  --abby-shadow:0 16px 50px rgba(0,0,0,.45);
  --abby-ring:0 0 0 3px rgba(139,92,246,.22);
  --abby-font:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
  --abby-mono:ui-monospace,'SF Mono',Menlo,Consolas,monospace;
  --abby-grad:linear-gradient(135deg,var(--abby-primary),var(--abby-accent));
  --abby-space:clamp(1rem,3.5vw,2.5rem);
}
*,*::before,*::after{box-sizing:border-box}
*{margin:0}
html{scroll-behavior:smooth;-webkit-text-size-adjust:100%}
body{
  background:
    radial-gradient(1200px 620px at 75% -12%, rgba(139,92,246,.14), transparent 60%),
    radial-gradient(900px 500px at 0% 100%, rgba(236,72,153,.08), transparent 55%),
    var(--abby-bg);
  color:var(--abby-text); font-family:var(--abby-font);
  line-height:1.65; min-height:100vh; font-size:clamp(15px,1.05vw,16.5px);
  -webkit-font-smoothing:antialiased; text-rendering:optimizeLegibility;
}
h1,h2,h3,h4,h5{line-height:1.12;font-weight:800;letter-spacing:-.02em;color:#fff}
h1{font-size:clamp(2.1rem,5.5vw,3.5rem)}
h2{font-size:clamp(1.6rem,3.6vw,2.4rem)}
h3{font-size:1.3rem}
p{color:var(--abby-text)}
small,.muted{color:var(--abby-muted)}
a{color:var(--abby-primary-2);text-decoration:none;transition:color .2s,opacity .2s}
a:hover{color:var(--abby-primary)}
img,svg,video,canvas{max-width:100%;display:block}
hr{border:none;height:1px;background:var(--abby-border);margin:2rem 0}
ul,ol{padding-left:1.25rem}
:focus-visible{outline:none;box-shadow:var(--abby-ring);border-radius:6px}
::selection{background:rgba(139,92,246,.35);color:#fff}

button,.btn{
  font:inherit;line-height:1;cursor:pointer;border:none;border-radius:9999px;
  padding:.8rem 1.7rem;font-weight:600;color:#fff;letter-spacing:.01em;
  background:var(--abby-grad);box-shadow:0 8px 26px rgba(139,92,246,.34);
  transition:transform .15s ease,box-shadow .2s ease,opacity .2s ease;
  display:inline-flex;align-items:center;justify-content:center;gap:.5rem;
}
button:hover,.btn:hover{transform:translateY(-2px);box-shadow:0 12px 34px rgba(139,92,246,.46)}
button:active,.btn:active{transform:translateY(0)}
button:disabled{opacity:.5;cursor:not-allowed;transform:none}
.btn-outline{background:transparent;color:var(--abby-text);border:1px solid var(--abby-border);box-shadow:none}
.btn-outline:hover{background:rgba(255,255,255,.05)}

input,textarea,select{
  font:inherit;width:100%;color:var(--abby-text);
  background:var(--abby-surface);border:1px solid var(--abby-border);
  border-radius:var(--abby-radius-sm);padding:.75rem 1rem;outline:none;
  transition:border-color .2s,box-shadow .2s;
}
input:focus,textarea:focus,select:focus{border-color:var(--abby-primary);box-shadow:var(--abby-ring)}
::placeholder{color:var(--abby-muted)}
label{font-size:.9rem;color:var(--abby-muted);font-weight:500}

table{width:100%;border-collapse:collapse;font-size:.95rem}
th,td{padding:.8rem 1rem;border-bottom:1px solid var(--abby-border);text-align:left}
th{color:var(--abby-muted);font-weight:600;font-size:.78rem;text-transform:uppercase;letter-spacing:.06em}
tr{transition:background .15s}
tbody tr:hover{background:rgba(255,255,255,.03)}

code{font-family:var(--abby-mono);background:var(--abby-surface);padding:.16em .42em;border-radius:6px;font-size:.9em}
pre{font-family:var(--abby-mono);background:var(--abby-surface);padding:1rem 1.25rem;border-radius:var(--abby-radius-sm);overflow:auto;border:1px solid var(--abby-border)}
pre code{background:none;padding:0}

::-webkit-scrollbar{width:11px;height:11px}
::-webkit-scrollbar-thumb{background:rgba(139,92,246,.4);border-radius:9999px;border:2px solid transparent;background-clip:padding-box}
::-webkit-scrollbar-thumb:hover{background:rgba(139,92,246,.6);background-clip:padding-box}
::-webkit-scrollbar-track{background:transparent}

/* Лёгкие утилиты (низкая специфичность — легко переопределяются) */
.container{width:min(1120px,92vw);margin-inline:auto}
.section{padding:clamp(3rem,8vw,6rem) 0}
.card{background:var(--abby-surface);border:1px solid var(--abby-border);border-radius:var(--abby-radius);padding:var(--abby-space);box-shadow:var(--abby-shadow)}
.card:hover{border-color:rgba(139,92,246,.3)}
.grid{display:grid;gap:1.25rem}
.grid-auto{display:grid;gap:1.25rem;grid-template-columns:repeat(auto-fit,minmax(240px,1fr))}
.flex{display:flex;gap:1rem}
.center{display:flex;align-items:center;justify-content:center}
.stack{display:flex;flex-direction:column;gap:1rem}
.gradient-text{background:var(--abby-grad);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;color:transparent}
.badge{display:inline-flex;align-items:center;gap:.4rem;padding:.3rem .8rem;border-radius:9999px;font-size:.8rem;font-weight:600;color:var(--abby-primary-2);background:rgba(139,92,246,.12);border:1px solid rgba(139,92,246,.25)}
.glass{background:rgba(255,255,255,.04);backdrop-filter:blur(16px);border:1px solid var(--abby-border)}

@keyframes abby-fade-up{from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:translateY(0)}}
.fade-up{animation:abby-fade-up .7s cubic-bezier(.2,.7,.2,1) both}

@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important;scroll-behavior:auto!important}}
`;

/** Есть ли среди файлов хотя бы один HTML. */
function hasHtml(files: AgentFile[]): boolean {
  return files.some((f) => /\.html?$/i.test(f.name));
}

/**
 * Подключает дизайн-систему к проекту: добавляет файл abby-theme.css и вставляет
 * <link> в <head> каждого HTML ПЕРВЫМ (чтобы style.css модели переопределял базу).
 * Идемпотентно: повторный вызов ничего не дублирует. Без HTML — возвращает как есть.
 */
export function injectTheme(files: AgentFile[]): AgentFile[] {
  if (!hasHtml(files)) return files;

  const out = files.map((f) => {
    if (!/\.html?$/i.test(f.name)) return f;
    if (f.content.includes(ABBY_THEME_FILE)) return f; // уже подключён
    // Файл темы лежит в корне проекта — для HTML во вложенных папках нужен ../.
    const depth = f.name.replace(/^\.?\//, "").split("/").length - 1;
    const href = "../".repeat(depth) + ABBY_THEME_FILE;
    const linkTag = `<link rel="stylesheet" href="${href}" />`;
    let html = f.content;
    if (/<head[^>]*>/i.test(html)) {
      html = html.replace(/<head[^>]*>/i, (m) => `${m}\n    ${linkTag}`);
    } else if (/<html[^>]*>/i.test(html)) {
      html = html.replace(/<html[^>]*>/i, (m) => `${m}\n  <head>\n    ${linkTag}\n  </head>`);
    } else {
      html = `${linkTag}\n${html}`;
    }
    return { ...f, content: html };
  });

  const alreadyHasFile = out.some((f) => f.name === ABBY_THEME_FILE);
  if (!alreadyHasFile) {
    out.unshift({ name: ABBY_THEME_FILE, language: "css", content: ABBY_THEME_CSS });
  }
  return out;
}
