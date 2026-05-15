import { useEffect, useMemo, useState } from "react";

type InstagramSectionProps = {
  pageUrls: string[];
  autoAdvanceMs?: number;
  tiltXDeg?: number;
  tiltYDeg?: number;
  isDragging?: boolean;
};

type EmbedPlatform = "instagram" | "youtube";

type EmbeddableTarget = {
  canEmbed: true;
  platform: EmbedPlatform;
  embedUrl: string;
  profileUrl: string;
  fallbackMessage: string;
};

type NonEmbeddableTarget = {
  canEmbed: false;
  profileUrl: string;
  fallbackMessage: string;
};

type ParsedTarget = EmbeddableTarget | NonEmbeddableTarget;

const EMBEDDABLE_TYPES = new Set(["p", "reel", "tv"]);

const parseYouTubeTarget = (pageUrl: string): ParsedTarget | null => {
  const fallbackUrl = pageUrl.trim().replace(/\/+$/, "");

  try {
    const parsedUrl = new URL(pageUrl);
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

    const embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=0&playsinline=1&loop=1&playlist=${videoId}&rel=0&modestbranding=1`;
    return {
      canEmbed: true,
      platform: "youtube",
      embedUrl,
      profileUrl: fallbackUrl,
      fallbackMessage: "Could not parse this YouTube URL.",
    };
  } catch {
    return null;
  }
};

const parseInstagramTarget = (pageUrl: string): ParsedTarget => {
  const fallbackUrl = pageUrl.trim().replace(/\/+$/, "");

  try {
    const parsedUrl = new URL(pageUrl);
    const host = parsedUrl.hostname.replace(/^www\./, "").toLowerCase();
    if (host !== "instagram.com") {
      const youtubeTarget = parseYouTubeTarget(pageUrl);
      if (youtubeTarget) {
        return youtubeTarget;
      }
      return {
        canEmbed: false,
        profileUrl: fallbackUrl,
        fallbackMessage:
          "Only Instagram post/reel links or valid YouTube links can be embedded.",
      };
    }

    const pathParts = parsedUrl.pathname
      .split("/")
      .filter((segment) => segment.length > 0);

    const embedTypeIndex = pathParts.findIndex((segment) =>
      EMBEDDABLE_TYPES.has(segment.toLowerCase()),
    );
    const contentType =
      embedTypeIndex >= 0
        ? pathParts[embedTypeIndex]?.toLowerCase()
        : undefined;
    const shortcode =
      embedTypeIndex >= 0 ? pathParts[embedTypeIndex + 1] : undefined;
    if (contentType && shortcode && EMBEDDABLE_TYPES.has(contentType)) {
      return {
        canEmbed: true,
        platform: "instagram",
        embedUrl: `https://www.instagram.com/${contentType}/${shortcode}/embed/captioned/`,
        profileUrl: fallbackUrl,
        fallbackMessage:
          "Instagram only allows embedding individual posts/reels, not full profile pages.",
      };
    }

    return {
      canEmbed: false,
      profileUrl: fallbackUrl,
      fallbackMessage:
        "Instagram only allows embedding individual posts/reels, not full profile pages.",
    };
  } catch {
    return {
      canEmbed: false,
      profileUrl: fallbackUrl,
      fallbackMessage: "This link could not be parsed for embedding.",
    };
  }
};

export default function InstagramSection({
  pageUrls,
  autoAdvanceMs = 9000,
  tiltXDeg = 0,
  tiltYDeg = 0,
  isDragging = false,
}: InstagramSectionProps) {
  const targets = useMemo(
    () => pageUrls.map((url) => parseInstagramTarget(url)),
    [pageUrls],
  );

  const instagramTargets = targets.filter(
    (target): target is EmbeddableTarget =>
      "platform" in target && target.platform === "instagram",
  );
  const youtubeTargets = targets.filter(
    (target): target is EmbeddableTarget =>
      "platform" in target && target.platform === "youtube",
  );

  const [activeInstagramIndex, setActiveInstagramIndex] = useState(0);
  const [activeYoutubeIndex, setActiveYoutubeIndex] = useState(0);
  const [embedFailures, setEmbedFailures] = useState<
    Partial<Record<EmbedPlatform, boolean>>
  >({});
  const isGithubPagesHost =
    typeof window !== "undefined" &&
    window.location.hostname.toLowerCase().endsWith("github.io");

  useEffect(() => {
    if (instagramTargets.length <= 1) {
      return;
    }

    const timer = window.setInterval(() => {
      setActiveInstagramIndex(
        (current) => (current + 1) % instagramTargets.length,
      );
    }, autoAdvanceMs);

    return () => {
      window.clearInterval(timer);
    };
  }, [autoAdvanceMs, instagramTargets.length]);

  const activeInstagramTarget =
    instagramTargets.length === 0
      ? undefined
      : instagramTargets[activeInstagramIndex % instagramTargets.length];

  const activeYoutubeTarget =
    youtubeTargets.length === 0
      ? undefined
      : youtubeTargets[activeYoutubeIndex % youtubeTargets.length];

  const stackTargets = [activeInstagramTarget, activeYoutubeTarget].filter(
    (target): target is EmbeddableTarget => Boolean(target),
  );
  const [frontPlatform, setFrontPlatform] =
    useState<EmbedPlatform>("instagram");

  const effectiveFrontPlatform: EmbedPlatform = stackTargets.some(
    (target) => target.platform === frontPlatform,
  )
    ? frontPlatform
    : activeInstagramTarget
      ? "instagram"
      : "youtube";

  const fallbackTarget = targets.find((target) => !target.canEmbed) ?? null;

  const renderTargets = [activeInstagramTarget, activeYoutubeTarget].filter(
    (target): target is EmbeddableTarget => Boolean(target),
  );

  const canSwapCards = stackTargets.length > 1;
  const canAdvanceYoutube =
    effectiveFrontPlatform === "youtube" && youtubeTargets.length > 1;

  const handleSwapCards = () => {
    if (!canSwapCards) {
      return;
    }

    setFrontPlatform((current) =>
      current === "instagram" ? "youtube" : "instagram",
    );
  };

  const handleNextYoutube = () => {
    if (youtubeTargets.length <= 1) {
      return;
    }

    setActiveYoutubeIndex((current) => (current + 1) % youtubeTargets.length);
  };

  const handleEmbedError = (platform: EmbedPlatform) => {
    setEmbedFailures((current) =>
      current[platform] ? current : { ...current, [platform]: true },
    );
  };

  return (
    <section className="instagram-section" aria-label="Instagram">
      <div className="instagram-card">
        <div
          className={`instagram-tilt-layer${isDragging ? " is-dragging" : ""}`}
          style={{
            transform: `perspective(1400px) rotateX(${tiltXDeg}deg) rotateY(${tiltYDeg}deg)`,
          }}
        >
          {stackTargets.length === 0 ? (
            <div className="instagram-fallback">
              <p className="instagram-note">
                {fallbackTarget?.fallbackMessage ??
                  "Add one Instagram post link and one YouTube video link."}
              </p>
              {fallbackTarget ? (
                <a
                  className="instagram-link"
                  href={fallbackTarget.profileUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open this link
                </a>
              ) : null}
            </div>
          ) : (
            <div className="instagram-stack-host">
              {renderTargets.map((target) => {
                const isFrontCard = target.platform === effectiveFrontPlatform;
                const isInstagramBlocked =
                  target.platform === "instagram" &&
                  (isGithubPagesHost || Boolean(embedFailures.instagram));
                const isYoutubeBlocked =
                  target.platform === "youtube" &&
                  Boolean(embedFailures.youtube);
                const isEmbedBlocked = isInstagramBlocked || isYoutubeBlocked;
                return (
                  <button
                    key={target.platform}
                    type="button"
                    className={`instagram-media-card${
                      isFrontCard ? " is-front" : " is-back"
                    }${isEmbedBlocked ? " is-link-card" : ""}`}
                    aria-label={
                      isEmbedBlocked
                        ? `Open ${target.platform} in a new tab`
                        : `${target.platform} card`
                    }
                    onClick={
                      isEmbedBlocked
                        ? () => {
                            window.open(
                              target.profileUrl,
                              "_blank",
                              "noopener,noreferrer",
                            );
                          }
                        : undefined
                    }
                  >
                    <div className="instagram-embed-host">
                      {isEmbedBlocked ? (
                        <div className="instagram-embed-blocked">
                          <p>
                            {isInstagramBlocked && isGithubPagesHost
                              ? "Instagram blocks iframe embeds on GitHub Pages. Click to open this post on Instagram."
                              : `Could not load this ${target.platform} embed. Click to open it in a new tab.`}
                          </p>
                        </div>
                      ) : (
                        <iframe
                          src={target.embedUrl}
                          title={`${target.platform} embed`}
                          className={`instagram-embed ${
                            isFrontCard ? "is-front-embed" : "is-back-embed"
                          }`}
                          loading="lazy"
                          allow="autoplay; clipboard-write; encrypted-media; picture-in-picture"
                          onError={() => handleEmbedError(target.platform)}
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
            </div>
          )}
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
