import { useRef } from "react";
import "./App.css";
import ParticleRender from "./features/particle-render/ParticleRender";

function App() {
  const particleRenderRef = useRef<{ reset: () => void }>(null);

  const handleRefresh = () => {
    particleRenderRef.current?.reset();
  };

  return (
    <div className="app-shell">
      <ParticleRender ref={particleRenderRef} />
      <aside className="events-panel" aria-label="Upcoming events">
        <h2>Upcoming Events</h2>
        <p>29/05/2026: HOF - Kortrijk</p>
        <p>11/07/2026 - 26/07/2026: Radio Vandewalle - Roeselare </p>
        <button onClick={handleRefresh} className="refresh-button">
          Reset visual
        </button>
      </aside>
    </div>
  );
}

export default App;
