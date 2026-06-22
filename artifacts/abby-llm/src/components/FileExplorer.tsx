import { useState } from "react";
import {
  ChevronRight, ChevronDown, Folder, FolderOpen,
  FileCode, FileText, File, Settings, Package
} from "lucide-react";

interface TreeNode {
  name: string;
  type: "dir" | "file";
  ext?: string;
  children?: TreeNode[];
  defaultOpen?: boolean;
}

const tree: TreeNode[] = [
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
            { name: "_document.tsx", type: "file", ext: "tsx" },
          ]},
          { name: "styles", type: "dir", children: [
            { name: "globals.css", type: "file", ext: "css" },
            { name: "tailwind.config.js", type: "file", ext: "js" },
          ]},
          { name: "lib", type: "dir", children: [] },
          { name: "public", type: "dir", children: [] },
        ]
      },
      { name: ".gitignore", type: "file", ext: "git" },
      { name: "next.config.js", type: "file", ext: "js" },
      { name: "package.json", type: "file", ext: "json" },
      { name: "README.md", type: "file", ext: "md" },
    ]
  }
];

function getIcon(node: TreeNode) {
  if (node.type === "dir") return null;
  switch (node.ext) {
    case "tsx": case "ts": return <FileCode className="w-3.5 h-3.5 text-[hsl(var(--abby-violet))]" />;
    case "js": return <FileCode className="w-3.5 h-3.5 text-yellow-400" />;
    case "css": return <FileCode className="w-3.5 h-3.5 text-purple-400" />;
    case "json": return <Settings className="w-3.5 h-3.5 text-orange-400" />;
    case "md": return <FileText className="w-3.5 h-3.5 text-gray-400" />;
    case "git": return <File className="w-3.5 h-3.5 text-red-400" />;
    default: return <File className="w-3.5 h-3.5 text-muted-foreground" />;
  }
}

function TreeItem({
  node, depth, selected, onSelect
}: {
  node: TreeNode;
  depth: number;
  selected: string;
  onSelect: (name: string) => void;
}) {
  const [open, setOpen] = useState(node.defaultOpen ?? false);

  return (
    <div>
      <div
        className={`file-tree-item ${selected === node.name ? "selected" : ""}`}
        style={{ paddingLeft: `${8 + depth * 12}px` }}
        onClick={() => {
          if (node.type === "dir") setOpen(o => !o);
          else onSelect(node.name);
        }}
      >
        {node.type === "dir" ? (
          <>
            {open
              ? <ChevronDown className="w-3 h-3 text-muted-foreground" />
              : <ChevronRight className="w-3 h-3 text-muted-foreground" />
            }
            {open
              ? <FolderOpen className="w-3.5 h-3.5 text-yellow-400/80" />
              : <Folder className="w-3.5 h-3.5 text-yellow-400/60" />
            }
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
        <TreeItem key={child.name} node={child} depth={depth + 1} selected={selected} onSelect={onSelect} />
      ))}
    </div>
  );
}

interface Props {
  selectedFile: string;
  onSelect: (f: string) => void;
}

export default function FileExplorer({ selectedFile, onSelect }: Props) {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="panel-title flex items-center justify-between">
        <span>Explorer</span>
      </div>
      <div className="overflow-y-auto flex-1 pb-2">
        {tree.map(node => (
          <TreeItem key={node.name} node={node} depth={0} selected={selectedFile} onSelect={onSelect} />
        ))}
      </div>

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
    </div>
  );
}
