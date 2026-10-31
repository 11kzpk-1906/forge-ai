import { useEffect, useState } from "react";

const stages = [
  { label: "Understanding your request", detail: "Reading intent and context", icon: "⌕" },
  { label: "Planning the approach", detail: "Choosing a useful engineering path", icon: "◇" },
  { label: "Working through the problem", detail: "Generating and checking the response", icon: "⌘" },
  { label: "Preparing the answer", detail: "Polishing the final result", icon: "✳" },
];

export function ThinkingTimeline() {
  const [activeStage, setActiveStage] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
      setActiveStage((current) => Math.min(current + 1, stages.length - 1));
    }, 1450);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <section className="thinking-timeline" aria-live="polite" aria-label="ForgeAI is preparing a response">
      <div className="thinking-timeline-heading">
        <span className="thinking-orbit"><i /></span>
        <div><strong>ForgeAI is thinking</strong><small>INTELLIGENCE PIPELINE · {elapsed}s</small></div>
        <span className="thinking-live"><i /> LIVE</span>
      </div>
      <div className="thinking-stages">
        {stages.map((stage, index) => {
          const complete = index < activeStage;
          const active = index === activeStage;
          return (
            <div className={complete ? "thinking-stage complete" : active ? "thinking-stage active" : "thinking-stage"} key={stage.label}>
              <span className="thinking-stage-marker">{complete ? "✓" : stage.icon}</span>
              <span className="thinking-stage-copy"><strong>{stage.label}</strong><small>{stage.detail}</small></span>
              <span className="thinking-stage-state">{complete ? "DONE" : active ? "ACTIVE" : "QUEUED"}</span>
            </div>
          );
        })}
      </div>
      <div className="thinking-progress"><span style={{ width: ((activeStage + 1) / stages.length * 100) + "%" }} /></div>
      <p className="thinking-footnote">This is a visual activity indicator; response generation continues independently.</p>
    </section>
  );
}
