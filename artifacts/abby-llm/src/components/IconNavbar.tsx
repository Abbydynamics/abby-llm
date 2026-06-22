import {
  FolderOpen, MessageSquare, Brain, Database,
  Zap, GitBranch, Settings, ChevronDown
} from "lucide-react";
import type { NavSection } from "@/App";

interface Props {
  active: NavSection;
  onSelect: (s: NavSection) => void;
}

const items: { id: NavSection; icon: React.ReactNode; label: string }[] = [
  { id: "projects", icon: <FolderOpen className="w-5 h-5" />, label: "Проекты" },
  { id: "chat", icon: <MessageSquare className="w-5 h-5" />, label: "Чат" },
  { id: "models", icon: <Brain className="w-5 h-5" />, label: "Модели" },
  { id: "datasets", icon: <Database className="w-5 h-5" />, label: "Датасеты" },
  { id: "training", icon: <Zap className="w-5 h-5" />, label: "Обучение" },
  { id: "git", icon: <GitBranch className="w-5 h-5" />, label: "Git" },
];

export default function IconNavbar({ active, onSelect }: Props) {
  return (
    <div className="glass-card flex flex-col items-center w-14 py-3 gap-1.5 flex-shrink-0">
      {items.map(item => (
        <button
          key={item.id}
          onClick={() => onSelect(item.id)}
          title={item.label}
          className={`nav-icon-btn ${active === item.id ? "active" : ""}`}
        >
          {item.icon}
        </button>
      ))}

      <div className="flex-1" />

      <button
        onClick={() => onSelect("settings")}
        title="Настройки"
        className={`nav-icon-btn ${active === "settings" ? "active" : ""}`}
      >
        <Settings className="w-5 h-5" />
      </button>
    </div>
  );
}
