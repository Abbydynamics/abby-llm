import { useState } from "react";
import {
  ChevronRight, ChevronDown, Folder, FolderOpen,
  FileCode, FileText, File, Settings, Trash2,
} from "lucide-react";
import { useAbby } from "@/hooks/useAbby";

interface TreeNode {
  name: string;
  type: "dir" | "file";
  ext?: string;
  path?: string;           // полный путь файла (для агент-файлов)
  children?: TreeNode[];
  defaultOpen?: boolean;
}

// Статическое дерево-заглушка (показывается, пока Abby ничего не сгенерировала)
const staticTree: TreeNode[] = [
  {
    name: "AbbyGPU", type: "dir", defaultOpen: true, children: [
      {
        name: "app", type: "dir", defaultOpen: true, children: [
          { name: "components", type: "dir", children: [
            { name: "sections", type: "dir", children: [
              { name: "Hero.tsx", type: "file", ext: "tsx" },
              { name: "Features.tsx", type: "file", ext: "tsx" },
            ]},
            { name: "ui", type: "dir", children: [] },
          ]},
          { name: "pages", type: "dir", children: [
            { name: "index.tsx", type: "file", ext: "tsx" },
            { name: "_app.tsx", type: "file", ext: "tsx" },
          ]},
          { name: "styles", type: "dir", children: [
            { name: "globals.css", type: "file", ext: "css" },
          ]},
        ]
      },
      { name: "package.json", type: "file", ext: "json" },
      { name: "README.md", type: "file", ext: "md" },
    ]
  }
];

/** Строит дерево папок/файлов из путей агент-файлов. */
function buildAgentTree(files: { name: string }[], root: string): TreeNode {
  const rootNode: TreeNode = { name: root, type: "dir", defaultOpen: true, children: [] };
  for (const f of files) {
    const parts = f.name.split("/").filter(Boolean);
    let cur = rootNode;
    parts.forEach((part, i) => {
      const isFile = i === parts.length - 1;
      if (isFile) {
        cur.children!.push({
          name: part,
          type: "file",
          ext: part.split(".").pop(),
          path: f.name,
        });
      } else {
        let dir = cur.children!.find(c => c.type === "dir" && c.name === part);
        if (!dir) {
          dir = { name: part, type: "dir", defaultOpen: true, children: [] };
          cur.children!.push(dir);
        }
        cur = dir;
      }
    });
  }
  return rootNode;
}

function getIcon(node: TreeNode) {
  if (node.type === "dir") return null;
  switch (node.ext) {
    case "tsx": case "ts": return <FileCode className="w-3.5 h-3.5 text-[hsl(var(--abby-violet))]" />;
    case "js": case "jsx": case "mjs": return <FileCode className="w-3.5 h-3.5 text-yellow-400" />;
    case "css": return <FileCode className="w-3.5 h-3.5 text-purple-400" />;
    case "html": case "htm": return <FileCode className="w-3.5 h-3.5 text-orange-400" />;
    case "json": return <Settings className="w-3.5 h-3.5 text-orange-400" />;
    case "md": return <FileText className="w-3.5 h-3.5 text-sky-400" />;
    default: return <File className="w-3.5 h-3.5 text-muted-foreground" />;
  }
}

function TreeItem({
  node, depth, selected, onSelect,
}: {
  node: TreeNode;
  depth: number;
  selected: string;
  onSelect: (key: string) => void;
}) {
  const [open, setOpen] = useState(node.defaultOpen ?? false);
  const key = node.path ?? node.name;

  return (
    <div>
      <div
        className={`file-tree-item ${selected === key ? "selected" : ""}`}
        style={{ paddingLeft: `${8 + depth * 12}px` }}
        onClick={() => {
          if (node.type === "dir") setOpen(o => !o);
          else onSelect(key);
        }}
      >
        {node.type === "dir" ? (
          <>
            {open
              ? <ChevronDown className="w-3 h-3 text-muted-foreground" />
              : <ChevronRight className="w-3 h-3 text-muted-foreground" />}
            {open
              ? <FolderOpen className="w-3.5 h-3.5 text-yellow-400/80" />
              : <Folder className="w-3.5 h-3.5 text-yellow-400/60" />}
          </>
        ) : (
          <>
            <span className="w-3 h-3" />
            {getIcon(node)}
          </>
        )}
        <span className="truncate">{node.name}</span>
      </div>
      {node.type === "dir" && open && node.children?.map(child => (
        <TreeItem
          key={child.path ?? child.name}
          node={child}
          depth={depth + 1}
          selected={selected}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

interface Props {
  selectedFile: string;
  onSelect: (f: string) => void;
}

export default function FileExplorer({ selectedFile, onSelect }: Props) {
  const { agentFiles, projectName, activeAgentFile, setActiveAgentFile, clearProject } = useAbby();
  const hasAgentFiles = agentFiles.length > 0;

  const tree: TreeNode[] = hasAgentFiles
    ? [buildAgentTree(agentFiles, projectName)]
    : staticTree;

  const selected = hasAgentFiles ? (activeAgentFile ?? "") : selectedFile;

  function handleSelect(key: string) {
    if (hasAgentFiles) setActiveAgentFile(key);
    else onSelect(key);
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="panel-title flex items-center justify-between">
        <span>Explorer</span>
        {hasAgentFiles && (
          <button
            onClick={clearProject}
            title="Очистить проект"
            className="text-muted-foreground hover:text-red-400 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      <div className="overflow-y-auto flex-1 pb-2">
        {tree.map(node => (
          <TreeItem
            key={node.path ?? node.name}
            node={node}
            depth={0}
            selected={selected}
            onSelect={handleSelect}
          />
        ))}
      </div>

      {hasAgentFiles ? (
        <div className="border-t border-border p-2">
          <div className="panel-title px-1 py-1">Файлы проекта</div>
          <div className="px-2 text-[10px] text-muted-foreground">
            {agentFiles.length} файл(ов) · сгенерировано Abby
          </div>
        </div>
      ) : (
        <div className="border-t border-border p-2">
          <div className="panel-title px-1 py-1">Outline</div>
          <div className="px-2 space-y-0.5">
            {["Home()", "Hero()", "Features()", "Roadmap()", "Footer()"].map(fn => (
              <div key={fn} className="file-tree-item text-purple-400">
                <span className="w-3" />
                <span>{fn}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
