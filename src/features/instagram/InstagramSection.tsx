import { useEffect, useMemo, useState } from "react";

type InstagramSectionProps = {
  mediaUrls: string[];
  youtubeUrls: string[];
  autoAdvanceMs?: number;
  tiltXDeg?: number;
  tiltYDeg?: number;
  isDragging?: boolean;
};

type Platform = "gallery" | "youtube";

type GalleryMediaKind = "image" | "video" | "placeholder";

type GalleryTarget = {
  platform: "gallery";
  mediaUrl: string;
  label: string;
  mediaKind: GalleryMediaKind;
};

type YouTubeTarget = {
  platform: "youtube";
  embedUrl: string;
  sourceUrl: string;
};

type CardTarget = GalleryTarget | YouTubeTarget;

const parseYouTubeTarget = (url: string): YouTubeTarget | null => {
  const sourceUrl = url.trim().replace(/\/+$/, "");

  try {
    const parsedUrl = new URL(url);
    const host = parsedUrl.hostname.replace(/^www\./, "").toLowerCase();

    let videoId: string | null = null;
    if (host === "youtube.com") {
      if (parsedUrl.pathname === "/watch") {
        videoId = parsedUrl.searchParams.get("v");
      } else if (parsedUrl.pathname.startsWith("/embed/")) {
        videoId = parsedUrl.pathname.split("/").filter(Boolean)[1] ?? null;
      } else if (parsedUrl.pathname.startsWith("/shorts/")) {
        videoId = parsedUrl.pathname.split("/").filter(Boolean)[1] ?? null;
      }
    } else if (host === "youtu.be") {
      videoId = parsedUrl.pathname.split("/").filter(Boolean)[0] ?? null;
    }

    if (!videoId) {
      return null;
    }

    return {
      platform: "youtube",
      embedUrl: `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=0&playsinline=1&loop=1&playlist=${videoId}&rel=0&modestbranding=1`,
      sourceUrl,
    };
  } catch {
    return null;
  }
};

const toImageAlt = (imageUrl: string, index: number) => {
  const lastPart = imageUrl.split("/").filter(Boolean).pop();
  if (!lastPart) {
    return `Gallery photo ${index + 1}`;
  }

  return lastPart
    .replace(/\.[a-zA-Z0-9]+$/, "")
    .replace(/[-_]+/g, " ")
    .trim();
};

const getGalleryMediaKind = (mediaUrl: string): GalleryMediaKind => {
  const cleanPath = mediaUrl.split(/[?#]/)[0].toLowerCase();
  return /\.(mp4|webm|mov)$/.test(cleanPath) ? "video" : "image";
};

export default function InstagramSection({
  mediaUrls,
  youtubeUrls,
  autoAdvanceMs = 9000,
  tiltXDeg = 0,
  tiltYDeg = 0,
  isDragging = false,
}: InstagramSectionProps) {
  const galleryTargets = useMemo(
    () =>
      mediaUrls
        .map((mediaUrl, index): GalleryTarget | null => {
          const cleaned = mediaUrl.trim();
          if (!cleaned) {
            return null;
          }

          return {
            platform: "gallery",
            mediaUrl: cleaned,
            label: toImageAlt(cleaned, index),
            mediaKind: getGalleryMediaKind(cleaned),
          };
        })
        .filter((target): target is GalleryTarget => Boolean(target)),
    [mediaUrls],
  );

  const youtubeTargets = useMemo(
    () =>
      youtubeUrls
        .map((url) => parseYouTubeTarget(url))
        .filter((target): target is YouTubeTarget => Boolean(target)),
    [youtubeUrls],
  );

  const [activeGalleryIndex, setActiveGalleryIndex] = useState(0);
  const [activeYoutubeIndex, setActiveYoutubeIndex] = useState(0);
  const [brokenMedia, setBrokenMedia] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (galleryTargets.length <= 1) {
      return;
    }

    const timer = window.setInterval(() => {
      setActiveGalleryIndex((current) => (current + 1) % galleryTargets.length);
    }, autoAdvanceMs);

    return () => {
      window.clearInterval(timer);
    };
  }, [autoAdvanceMs, galleryTargets.length]);

  const activeGalleryTarget =
    galleryTargets.length === 0
      ? {
          platform: "gallery" as const,
          mediaUrl: "",
          label: "Gallery placeholder",
          mediaKind: "placeholder" as const,
        }
      : galleryTargets[activeGalleryIndex % galleryTargets.length];

  const activeYoutubeTarget =
    youtubeTargets.length === 0
      ? undefined
      : youtubeTargets[activeYoutubeIndex % youtubeTargets.length];

  const stackTargets = [activeGalleryTarget, activeYoutubeTarget].filter(
    (target): target is CardTarget => Boolean(target),
  );
  const [frontPlatform, setFrontPlatform] = useState<Platform>("gallery");

  const effectiveFrontPlatform: Platform = stackTargets.some(
    (target) => target.platform === frontPlatform,
  )
    ? frontPlatform
    : "gallery";

  const renderTargets = [activeGalleryTarget, activeYoutubeTarget].filter(
    (target): target is CardTarget => Boolean(target),
  );

  const canSwapCards = stackTargets.length > 1;
  const canAdvanceGallery =
    effectiveFrontPlatform === "gallery" && galleryTargets.length > 1;
  const canAdvanceYoutube =
    effectiveFrontPlatform === "youtube" && youtubeTargets.length > 1;

  const handleSwapCards = () => {
    if (!canSwapCards) {
      return;
    }

    setFrontPlatform((current) =>
      current === "gallery" ? "youtube" : "gallery",
    );
  };

  const handleNextYoutube = () => {
    if (youtubeTargets.length <= 1) {
      return;
    }

    setActiveYoutubeIndex((current) => (current + 1) % youtubeTargets.length);
  };

  const handleNextGallery = () => {
    if (galleryTargets.length <= 1) {
      return;
    }

    setActiveGalleryIndex((current) => (current + 1) % galleryTargets.length);
  };

  const handleMediaError = (mediaUrl: string) => {
    setBrokenMedia((current) =>
      current[mediaUrl] ? current : { ...current, [mediaUrl]: true },
    );
  };

  return (
    <section className="instagram-section" aria-label="Media gallery">
      <div className="instagram-card">
        <div
          className={`instagram-tilt-layer${isDragging ? " is-dragging" : ""}`}
          style={{
            transform: `perspective(1400px) rotateX(${tiltXDeg}deg) rotateY(${tiltYDeg}deg)`,
          }}
        >
          <div className="instagram-stack-host">
            {renderTargets.map((target) => {
              const isFrontCard = target.platform === effectiveFrontPlatform;
              return (
                <button
                  key={target.platform}
                  type="button"
                  className={`instagram-media-card${
                    isFrontCard ? " is-front" : " is-back"
                  }`}
                  aria-label={`${target.platform} card`}
                >
                  <div className="instagram-embed-host">
                    {target.platform === "gallery" ? (
                      target.mediaKind === "placeholder" ? (
                        <div className="instagram-embed-blocked">
                          <p>
                            Add media files in src/assets/instagram-gallery or
                            public/instagram-gallery to fill this card.
                          </p>
                        </div>
                      ) : brokenMedia[target.mediaUrl] ? (
                        <div className="instagram-embed-blocked">
                          <p>
                            Missing media: {target.mediaUrl}
                            <br />
                            Add this file in src/assets/instagram-gallery or
                            public/instagram-gallery.
                          </p>
                        </div>
                      ) : target.mediaKind === "video" ? (
                        <video
                          key={`gallery-video-${activeGalleryIndex}-${target.mediaUrl}`}
                          src={target.mediaUrl}
                          className="instagram-gallery-video instagram-gallery-animated"
                          autoPlay
                          loop
                          muted
                          playsInline
                          preload="metadata"
                          onError={() => handleMediaError(target.mediaUrl)}
                        />
                      ) : (
                        <img
                          key={`gallery-image-${activeGalleryIndex}-${target.mediaUrl}`}
                          src={target.mediaUrl}
                          alt={target.label}
                          className="instagram-gallery-image instagram-gallery-animated"
                          loading="lazy"
                          onError={() => handleMediaError(target.mediaUrl)}
                        />
                      )
                    ) : (
                      <iframe
                        src={target.embedUrl}
                        title={`${target.platform} embed`}
                        className={`instagram-embed ${
                          isFrontCard ? "is-front-embed" : "is-back-embed"
                        }`}
                        loading="lazy"
                        allow="autoplay; clipboard-write; encrypted-media; picture-in-picture"
                      />
                    )}
                    {target.platform === "youtube" ? (
                      <div className="muted-audio-badge" aria-hidden="true">
                        <svg viewBox="0 0 24 24" className="muted-audio-icon">
                          <path
                            d="M4 10h4l5-4v12l-5-4H4z"
                            fill="currentColor"
                          />
                          <path
                            d="M16 9.5a3.5 3.5 0 0 1 0 5"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                          />
                          <path
                            d="M18.5 7a7 7 0 0 1 0 10"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                          />
                        </svg>
                        <span className="muted-bars" aria-hidden="true">
                          <span className="bar bar-1" />
                          <span className="bar bar-2" />
                          <span className="bar bar-3" />
                        </span>
                      </div>
                    ) : null}
                  </div>
                </button>
              );
            })}
            {canAdvanceYoutube ? (
              <button
                type="button"
                className="youtube-next-button"
                onClick={handleNextYoutube}
                aria-label="Play next YouTube video"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M8 7.5 15.5 12 8 16.5z" fill="currentColor" />
                  <path
                    d="M18 7v10"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            ) : null}
            {canAdvanceGallery ? (
              <button
                type="button"
                className="gallery-next-button"
                onClick={handleNextGallery}
                aria-label="Show next gallery media"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M8 7.5 15.5 12 8 16.5z" fill="currentColor" />
                  <path
                    d="M18 7v10"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            ) : null}
          </div>
        </div>
        {canSwapCards ? (
          <button
            type="button"
            className="instagram-swap-button"
            onClick={handleSwapCards}
            aria-label="Swap front and back cards"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M5 8h10"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="m12 5 3 3-3 3"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M19 16H9"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="m12 13-3 3 3 3"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        ) : null}
      </div>
    </section>
  );
}
