import "./App.css";
import ParticleRender from "./features/particle-render/ParticleRender";
import InstagramSection from "./features/instagram/InstagramSection";

const YOUTUBE_LINKS = [
  "https://www.youtube.com/watch?v=5ssOaawUQq8",
  "https://www.youtube.com/watch?v=wESyMM0NW8o",
  "https://www.youtube.com/watch?v=ou78Tuy_MNM",
  "https://www.youtube.com/watch?v=t7OIc-DBRXM",
  "https://www.youtube.com/watch?v=JlQoMeRRbkM",
];
const SUPPORTED_GALLERY_MEDIA = /\.(jpg|jpeg|png|webp|avif|gif|mp4|webm|mov)$/i;
const SRC_GALLERY_MEDIA_MODULES = import.meta.glob(
  "./assets/instagram-gallery/**/*",
  {
    eager: true,
    import: "default",
    query: "?url",
  },
) as Record<string, string>;
const SRC_GALLERY_MEDIA_PATHS = Object.values(SRC_GALLERY_MEDIA_MODULES).filter(
  (url) => SUPPORTED_GALLERY_MEDIA.test(url),
);
const PUBLIC_GALLERY_MEDIA_FILES = Object.keys(
  import.meta.glob("../public/instagram-gallery/**/*"),
).filter((filePath) => SUPPORTED_GALLERY_MEDIA.test(filePath));
const BASE_PATH = import.meta.env.BASE_URL;
const PUBLIC_GALLERY_MEDIA_PATHS = PUBLIC_GALLERY_MEDIA_FILES.map((filePath) =>
  `${BASE_PATH}${filePath.replace(/^\.\.\/public\//, "")}`.replace(/\/+/g, "/"),
);
const GALLERY_MEDIA_PATHS = Array.from(
  new Set([...SRC_GALLERY_MEDIA_PATHS, ...PUBLIC_GALLERY_MEDIA_PATHS]),
).sort((a, b) => a.localeCompare(b));
const RANDOM_YOUTUBE_START = Math.floor(Math.random() * YOUTUBE_LINKS.length);
const YOUTUBE_LINKS_ROTATED = [
  ...YOUTUBE_LINKS.slice(RANDOM_YOUTUBE_START),
  ...YOUTUBE_LINKS.slice(0, RANDOM_YOUTUBE_START),
];

function App() {
  return (
    <div className="app-shell">
      <main className="split-layout">
        <section className="scene-section" aria-label="3D visual">
          <ParticleRender />
        </section>

        <InstagramSection
          mediaUrls={GALLERY_MEDIA_PATHS}
          youtubeUrls={YOUTUBE_LINKS_ROTATED}
          tiltXDeg={-4}
          tiltYDeg={-16}
          isDragging={false}
        />
      </main>

      <aside className="events-panel" aria-label="Upcoming events">
        <h2>Upcoming Events</h2>
        <p>29/05/2026: HOF - Kortrijk</p>
        <p>11/07/2026 - 26/07/2026: Radio Vandewalle - Roeselare </p>
      </aside>
    </div>
  );
}

export default App;
