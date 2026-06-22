import { useState } from "react";
import IconNavbar from "@/components/IconNavbar";
import LeftPanel from "@/components/LeftPanel";
import EditorPanel from "@/components/EditorPanel";
import TerminalPanel from "@/components/TerminalPanel";
import AbbyChat from "@/components/AbbyChat";
import TrainingProgress from "@/components/TrainingProgress";
import DatasetOverview from "@/components/DatasetOverview";
import AbbyBrain from "@/components/AbbyBrain";
import TopBar from "@/components/TopBar";

export type NavSection = "projects" | "chat" | "models" | "datasets" | "training" | "git" | "settings";
export type ModelName = "AbbyCoder 150M" | "AbbyCoder 500M" | "AbbyGPT 1B";

export default function App() {
  const [activeNav, setActiveNav] = useState<NavSection>("chat");
  const [selectedFile, setSelectedFile] = useState("index.tsx");

  return (
    <div className="h-screen w-screen p-2.5 overflow-hidden">
      {/* Rounded liquid-glass app window */}
      <div className="glass flex flex-col h-full w-full rounded-[22px] overflow-hidden">
        <TopBar />
        <div className="flex flex-1 min-h-0 gap-2.5 p-2.5">
          {/* Left icon nav */}
          <IconNavbar active={activeNav} onSelect={setActiveNav} />
          {/* Left panel (switches with nav) */}
          <div className="glass-card w-52 flex-shrink-0 flex flex-col overflow-hidden">
            <LeftPanel active={activeNav} selectedFile={selectedFile} onSelectFile={setSelectedFile} />
          </div>
          {/* Main content */}
          <div className="flex flex-col flex-1 min-w-0 gap-2.5">
            {/* Editor + Right panel */}
            <div className="flex flex-1 min-h-0 gap-2.5">
              {/* Editor area */}
              <div className="glass-card flex flex-col flex-1 min-w-0 overflow-hidden">
                <EditorPanel selectedFile={selectedFile} onSelectFile={setSelectedFile} />
              </div>
              {/* Right: Abby AI panel */}
              <div className="glass-card w-80 flex-shrink-0 flex flex-col overflow-hidden">
                <AbbyChat />
              </div>
            </div>
            {/* Terminal panel */}
            <div className="glass-card overflow-hidden flex-shrink-0" style={{ height: 150 }}>
              <TerminalPanel />
            </div>
          </div>
        </div>

        {/* Bottom dashboards row */}
        <div className="flex gap-2.5 px-2.5 pb-2.5 flex-shrink-0" style={{ height: 200 }}>
          <div className="glass-card flex-1 overflow-hidden">
            <TrainingProgress />
          </div>
          <div className="glass-card flex-1 overflow-hidden">
            <DatasetOverview />
          </div>
          <div className="glass-card flex-1 overflow-hidden">
            <AbbyBrain />
          </div>
        </div>
      </div>
    </div>
  );
}
