import { useAbby } from "@/hooks/useAbby";
import abbyBrain from "@/assets/abby-brain.png";

const TECHNOLOGIES = [
  { name: "Python", color: "text-[hsl(var(--abby-violet))] border-[hsl(var(--abby-violet))]/30 bg-[hsl(var(--abby-violet))]/10" },
  { name: "FastAPI", color: "text-[hsl(var(--abby-green))] border-[hsl(var(--abby-green))]/30 bg-[hsl(var(--abby-green))]/10" },
  { name: "React", color: "text-[hsl(var(--abby-blue))] border-[hsl(var(--abby-blue))]/30 bg-[hsl(var(--abby-blue))]/10" },
  { name: "Next.js", color: "text-foreground border-white/15 bg-white/5" },
  { name: "Docker", color: "text-[hsl(var(--abby-blue))] border-[hsl(var(--abby-blue))]/30 bg-[hsl(var(--abby-blue))]/10" },
  { name: "PostgreSQL", color: "text-[hsl(var(--abby-blue))] border-[hsl(var(--abby-blue))]/30 bg-[hsl(var(--abby-blue))]/10" },
  { name: "TypeScript", color: "text-[hsl(var(--abby-violet))] border-[hsl(var(--abby-violet))]/30 bg-[hsl(var(--abby-violet))]/10" },
  { name: "Solana", color: "text-[hsl(var(--abby-purple))] border-[hsl(var(--abby-purple))]/30 bg-[hsl(var(--abby-purple))]/10" },
  { name: "AI/ML", color: "text-[hsl(var(--abby-magenta))] border-[hsl(var(--abby-magenta))]/30 bg-[hsl(var(--abby-magenta))]/10" },
  { name: "Electron", color: "text-[hsl(var(--abby-blue))] border-[hsl(var(--abby-blue))]/30 bg-[hsl(var(--abby-blue))]/10" },
  { name: "PyTorch", color: "text-[hsl(var(--abby-orange))] border-[hsl(var(--abby-orange))]/30 bg-[hsl(var(--abby-orange))]/10" },
  { name: "CUDA", color: "text-[hsl(var(--abby-green))] border-[hsl(var(--abby-green))]/30 bg-[hsl(var(--abby-green))]/10" },
];

function AnimatedBrain({ active }: { active: boolean }) {
  return (
    <div className="relative w-24 h-24 mx-auto flex items-center justify-center">
      <div
        className={`absolute inset-0 rounded-full blur-xl transition-opacity ${active ? "opacity-80" : "opacity-50"}`}
        style={{ background: "radial-gradient(circle, hsl(275 85% 60% / 0.6), transparent 70%)" }}
      />
      <img
        src={abbyBrain}
        alt="Abby Brain"
        className={`relative w-24 h-24 object-contain drop-shadow-[0_0_18px_hsl(275_85%_60%/0.7)] ${active ? "animate-pulse" : ""}`}
        style={active ? { animationDuration: "2.2s" } : undefined}
      />
    </div>
  );
}

function trainingLevel(tokens: number): string {
  if (tokens === 0) return "Untrained";
  if (tokens < 10000) return "Beginner";
  if (tokens < 100000) return "Intermediate";
  if (tokens < 1000000) return "Advanced";
  return "Expert";
}

export default function AbbyBrain() {
  const { model, training } = useAbby();
  const tokensSeen = training?.tokensSeen ?? 0;
  const active = training?.status === "running";

  // Confidence derived from inverse perplexity (real metric)
  const ppl = training?.perplexity ?? 0;
  const confidence =
    ppl > 0 ? Math.max(5, Math.min(99, Math.round(100 - Math.min(95, (Math.log(ppl) / Math.log(50000)) * 100)))) : 0;

  const level = trainingLevel(tokensSeen);

  return (
    <div className="h-full flex flex-col p-3 overflow-hidden">
      <div className="flex items-center justify-between mb-2 flex-shrink-0">
        <span className="text-[11px] font-semibold text-foreground">Abby Brain</span>
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${active ? "text-[hsl(var(--abby-green))] bg-[hsl(var(--abby-green))]/10 border-[hsl(var(--abby-green))]/20" : "text-[hsl(var(--abby-violet))] bg-[hsl(var(--abby-violet))]/10 border-[hsl(var(--abby-violet))]/20"}`}>
          {active ? "Training" : "Ready"}
        </span>
      </div>

      <div className="flex flex-1 min-h-0 gap-3">
        <div className="flex flex-col items-center justify-center gap-2 w-28 flex-shrink-0">
          <AnimatedBrain active={active} />
          <div className="text-center">
            <div className="text-[10px] text-muted-foreground">Model</div>
            <div className="text-[11px] font-semibold text-[hsl(var(--abby-violet))]">{model}</div>
          </div>
        </div>

        <div className="flex-1 flex flex-col gap-2 min-w-0 overflow-hidden">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Knowledge</div>
          <div className="flex flex-wrap gap-1 overflow-hidden" style={{ maxHeight: 80 }}>
            {TECHNOLOGIES.map((tech) => (
              <span key={tech.name} className={`badge-tech ${tech.color} text-[9.5px]`}>{tech.name}</span>
            ))}
          </div>

          <div className="mt-auto">
            <div className="flex items-center justify-between text-[10px] mb-1">
              <span className="text-muted-foreground">Confidence</span>
              <span className="text-foreground font-semibold">{confidence}%</span>
            </div>
            <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-[hsl(var(--abby-violet))] to-[hsl(var(--abby-magenta))] transition-all duration-700" style={{ width: `${confidence}%` }} />
            </div>
            <div className="flex items-center justify-between text-[10px] mt-2">
              <span className="text-muted-foreground">Training Level</span>
              <span className="text-[hsl(var(--abby-green))] font-semibold">{level}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
