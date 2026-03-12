import "./App.css";
import ParticleRender from "./features/particle-render/ParticleRender";

function App() {
  return (
    <div className="app-shell">
      <ParticleRender />
      <aside className="events-panel" aria-label="Upcoming events">
        <h2>Upcoming Events</h2>
        <p>29/05/2026: HOF - Kortrijk</p>
        <p>11/07/2026 - 26/07/2026: Radio Vandewalle - Roeselare </p>
      </aside>
    </div>
  );
}

export default App;
