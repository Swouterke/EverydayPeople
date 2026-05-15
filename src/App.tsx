import { useRef, useState } from "react";
import "./App.css";
import ParticleRender from "./features/particle-render/ParticleRender";
import InstagramSection from "./features/instagram/InstagramSection";

const TILT_SENSITIVITY = 0.12;
const MAX_TILT_DEGREES = 16;
const YOUTUBE_LINKS = [
  "https://www.youtube.com/watch?v=5ssOaawUQq8",
  "https://www.youtube.com/watch?v=wESyMM0NW8o",
  "https://www.youtube.com/watch?v=ou78Tuy_MNM",
  "https://www.youtube.com/watch?v=t7OIc-DBRXM",
  "https://www.youtube.com/watch?v=JlQoMeRRbkM",
];
const RANDOM_YOUTUBE_START = Math.floor(Math.random() * YOUTUBE_LINKS.length);
const YOUTUBE_LINKS_ROTATED = [
  ...YOUTUBE_LINKS.slice(RANDOM_YOUTUBE_START),
  ...YOUTUBE_LINKS.slice(0, RANDOM_YOUTUBE_START),
];

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

function App() {
  const particleRenderRef = useRef<{ reset: () => void }>(null);
  const dragStateRef = useRef({ active: false, pointerId: -1, x: 0, y: 0 });
  const [instagramTilt, setInstagramTilt] = useState({ x: -1.8, y: 2.4 });
  const [isDraggingScene, setIsDraggingScene] = useState(false);
  const instagramPostUrls = [
    "https://www.instagram.com/everyday._.people/p/DYFO0lljV3k/",
    "https://www.instagram.com/everyday._.people/p/DVy5DAgjtrE/",
    "https://www.instagram.com/everyday._.people/p/DSxNomvDGyO/",
    ...YOUTUBE_LINKS_ROTATED,
  ];

  const handleRefresh = () => {
    particleRenderRef.current?.reset();
  };

  const handleScenePointerDown = (event: React.PointerEvent<HTMLElement>) => {
    dragStateRef.current = {
      active: true,
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    };
    setIsDraggingScene(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleScenePointerMove = (event: React.PointerEvent<HTMLElement>) => {
    if (
      !dragStateRef.current.active ||
      dragStateRef.current.pointerId !== event.pointerId
    ) {
      return;
    }

    const dx = event.clientX - dragStateRef.current.x;
    const dy = event.clientY - dragStateRef.current.y;

    setInstagramTilt((current) => ({
      x: clamp(
        current.x - dy * TILT_SENSITIVITY,
        -MAX_TILT_DEGREES,
        MAX_TILT_DEGREES,
      ),
      y: clamp(
        current.y + dx * TILT_SENSITIVITY,
        -MAX_TILT_DEGREES,
        MAX_TILT_DEGREES,
      ),
    }));

    dragStateRef.current.x = event.clientX;
    dragStateRef.current.y = event.clientY;
  };

  const handleScenePointerUp = (event: React.PointerEvent<HTMLElement>) => {
    if (dragStateRef.current.pointerId !== event.pointerId) {
      return;
    }

    dragStateRef.current.active = false;
    setIsDraggingScene(false);
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  return (
    <div className="app-shell">
      <main className="split-layout">
        <section
          className="scene-section"
          aria-label="3D visual"
          onPointerDown={handleScenePointerDown}
          onPointerMove={handleScenePointerMove}
          onPointerUp={handleScenePointerUp}
          onPointerCancel={handleScenePointerUp}
        >
          <ParticleRender ref={particleRenderRef} />
        </section>

        <InstagramSection
          pageUrls={instagramPostUrls}
          tiltXDeg={instagramTilt.x}
          tiltYDeg={instagramTilt.y}
          isDragging={isDraggingScene}
        />
      </main>

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
