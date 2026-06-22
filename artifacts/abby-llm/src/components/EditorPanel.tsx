import { useState } from "react";
import Editor from "@monaco-editor/react";
import { X, RotateCcw, SplitSquareHorizontal, MoreHorizontal, ChevronRight } from "lucide-react";

const FILES: Record<string, { lang: string; content: string }> = {
  "index.tsx": {
    lang: "typescript",
    content: `import { Hero } from '@/components/sections/Hero'
import { Features } from '@/components/sections/Features'
import { Roadmap } from '@/components/sections/Roadmap'
import { Footer } from '@/components/sections/Footer'

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-[#0B1020] to-[#0
      <Hero />
      <Features />
      <Roadmap />
      <Footer />
    </main>
  )
}`
  },
  "Header.tsx": {
    lang: "typescript",
    content: `import { useState } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'

export function Header() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <motion.header
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed top-0 w-full z-50 backdrop-blur-md bg-black/30 border-b border-white/10"
    >
      <nav className="container mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold gradient-text">
          AbbyGPU
        </Link>
        <div className="flex items-center gap-6">
          {['Features', 'Docs', 'Pricing', 'Blog'].map(item => (
            <Link key={item} href={\`/\${item.toLowerCase()}\`}
              className="text-sm text-gray-400 hover:text-white transition-colors">
              {item}
            </Link>
          ))}
        </div>
      </nav>
    </motion.header>
  )
}`
  },
  "Roadmap.tsx": {
    lang: "typescript",
    content: `import { motion } from 'framer-motion'
import { CheckCircle2, Clock, Zap } from 'lucide-react'

const PHASES = [
  { phase: 'Q1 2025', title: 'Foundation', status: 'done',
    items: ['Core architecture', 'Training pipeline', 'Basic inference'] },
  { phase: 'Q2 2025', title: 'Scale', status: 'done',
    items: ['150M model release', 'API access', 'Fine-tuning support'] },
  { phase: 'Q3 2025', title: 'Intelligence', status: 'running',
    items: ['500M model', 'Multimodal support', 'Agent framework'] },
  { phase: 'Q4 2025', title: 'Production', status: 'pending',
    items: ['1B model release', 'Enterprise tier', 'Marketplace launch'] },
]

export function Roadmap() {
  return (
    <section className="py-24 relative">
      <div className="container mx-auto px-6">
        <h2 className="text-4xl font-bold text-center mb-16 gradient-text">
          Roadmap
        </h2>
        <div className="grid grid-cols-4 gap-6">
          {PHASES.map((p, i) => (
            <motion.div key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="bg-white/5 rounded-xl p-6 border border-white/10">
              <div className="text-[hsl(var(--abby-violet))] text-xs font-semibold mb-1">{p.phase}</div>
              <h3 className="font-bold text-lg mb-3">{p.title}</h3>
              {p.items.map(item => (
                <div key={item} className="flex items-center gap-2 text-sm text-gray-400 mb-1">
                  {p.status === 'done' ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400" /> :
                   p.status === 'running' ? <Zap className="w-3.5 h-3.5 text-[hsl(var(--abby-violet))]" /> :
                   <Clock className="w-3.5 h-3.5" />}
                  {item}
                </div>
              ))}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}`
  },
  "globals.css": {
    lang: "css",
    content: `@import "tailwindcss";

:root {
  --abby-blue: 217 91% 60%;
  --abby-purple: 262 83% 68%;
  --abby-dark: 222 47% 6%;
}

.gradient-text {
  background: linear-gradient(135deg, #8b5cf6, #8b5cf6);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.glass {
  backdrop-filter: blur(12px);
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

@keyframes float {
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-10px); }
}

.float { animation: float 4s ease-in-out infinite; }`
  }
};

const TAB_ORDER = ["index.tsx", "Header.tsx", "Roadmap.tsx", "globals.css"];

interface Props {
  selectedFile: string;
  onSelectFile: (f: string) => void;
}

export default function EditorPanel({ selectedFile, onSelectFile }: Props) {
  const [openTabs, setOpenTabs] = useState(TAB_ORDER);
  const activeFile = openTabs.includes(selectedFile) ? selectedFile : openTabs[0];
  const file = FILES[activeFile] ?? FILES["index.tsx"];

  function closeTab(tab: string, e: React.MouseEvent) {
    e.stopPropagation();
    const next = openTabs.filter(t => t !== tab);
    setOpenTabs(next);
    if (activeFile === tab && next.length > 0) onSelectFile(next[0]);
  }

  const breadcrumb = ["app", "pages", activeFile];

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-transparent">
      {/* Tab bar */}
      <div className="flex items-center bg-transparent border-b border-border overflow-x-auto flex-shrink-0">
        {openTabs.map(tab => {
          const isActive = tab === activeFile;
          const ext = tab.split(".").pop();
          const color = ext === "tsx" || ext === "ts" ? "text-[hsl(var(--abby-violet))]" :
                        ext === "css" ? "text-purple-400" : "text-yellow-400";
          return (
            <div
              key={tab}
              onClick={() => onSelectFile(tab)}
              className={`flex items-center gap-1.5 px-3 h-9 text-[12px] cursor-pointer border-r border-border flex-shrink-0 transition-colors
                ${isActive ? "bg-white/5 text-foreground border-t-2 border-t-[hsl(var(--abby-violet))] border-r-border" : "text-muted-foreground hover:text-foreground hover:bg-white/3"}`}
            >
              <span className={`text-[10px] font-mono font-semibold ${color}`}>
                {ext?.toUpperCase().slice(0, 2)}
              </span>
              <span>{tab}</span>
              <button
                onClick={e => closeTab(tab, e)}
                className="ml-1 w-4 h-4 flex items-center justify-center rounded hover:bg-white/10 text-muted-foreground hover:text-foreground"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </div>
          );
        })}
        <div className="flex-1" />
        <div className="flex items-center gap-1 px-2">
          <button className="nav-icon-btn w-7 h-7"><RotateCcw className="w-3 h-3" /></button>
          <button className="nav-icon-btn w-7 h-7"><SplitSquareHorizontal className="w-3 h-3" /></button>
          <button className="nav-icon-btn w-7 h-7"><MoreHorizontal className="w-3 h-3" /></button>
        </div>
      </div>

      {/* Breadcrumb */}
      <div className="flex items-center gap-1 px-3 py-1 text-[11px] text-muted-foreground border-b border-border bg-transparent flex-shrink-0">
        {breadcrumb.map((part, i) => (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="w-3 h-3" />}
            <span className={i === breadcrumb.length - 1 ? "text-foreground" : ""}>{part}</span>
          </span>
        ))}
      </div>

      {/* Monaco Editor */}
      <div className="flex-1 min-h-0">
        <Editor
          key={activeFile}
          defaultValue={file.content}
          language={file.lang}
          theme="vs-dark"
          options={{
            fontSize: 13,
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            fontLigatures: true,
            minimap: { enabled: true, scale: 1 },
            lineNumbers: "on",
            renderLineHighlight: "line",
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            wordWrap: "on",
            padding: { top: 8 },
            smoothScrolling: true,
            cursorBlinking: "smooth",
            cursorSmoothCaretAnimation: "on",
          }}
        />
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between px-3 py-0.5 bg-[hsl(var(--abby-violet))] text-white text-[11px] flex-shrink-0">
        <div className="flex items-center gap-3">
          <span>Ln 8, Col 17</span>
          <span>Spaces: 2</span>
          <span>UTF-8</span>
          <span>LF</span>
          <span className="font-semibold">TSX</span>
        </div>
        <div className="flex items-center gap-3">
          <span>AbbyCoder 150M</span>
          <span>✓ Prettier</span>
          <span>⎇ main</span>
        </div>
      </div>
    </div>
  );
}
