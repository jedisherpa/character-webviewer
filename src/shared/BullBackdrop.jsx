import { useEffect, useState } from "react";
import { ORIGINAL_WALL_STREET_BULL } from "../contracts/scenes.js";
import "./BullBackdrop.css";

/** Default composite plate (fallback when stack assets missing). */
export const DEFAULT_BULL_PLATE_URL =
  ORIGINAL_WALL_STREET_BULL.compositeFile ||
  "/bull-plates/frame_001_Wide_Establishing_Orbit_0deg.jpg";

/**
 * Wall Street Bull world stack:
 *   street plate (z0, world rear) → transparent bull cutout (z2, middle) → performer layer outside.
 * Depth stack mode is not an always-on-top mask.
 */
export function BullBackdrop({
  src,
  streetSrc = ORIGINAL_WALL_STREET_BULL.streetFile,
  overlaySrc = ORIGINAL_WALL_STREET_BULL.overlayFile,
  ndcBox = ORIGINAL_WALL_STREET_BULL.ndcBox,
  depthStack = true,
  fit = "cover",
  className = "",
}) {
  const [ready, setReady] = useState(false);
  const [overlayReady, setOverlayReady] = useState(false);
  const useStack = Boolean(depthStack && streetSrc && overlaySrc);
  const plateUrl = useStack ? streetSrc : src || DEFAULT_BULL_PLATE_URL;

  useEffect(() => {
    setReady(false);
    setOverlayReady(false);
  }, [plateUrl, overlaySrc]);

  const overlayStyle = ndcBox
    ? {
        position: "absolute",
        left: `${ndcBox.x0 * 100}%`,
        top: `${ndcBox.y0 * 100}%`,
        width: `${(ndcBox.x1 - ndcBox.x0) * 100}%`,
        height: `${(ndcBox.y1 - ndcBox.y0) * 100}%`,
        objectFit: "contain",
        pointerEvents: "none",
        zIndex: 2,
      }
    : {
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        objectFit: "contain",
        pointerEvents: "none",
        zIndex: 2,
      };

  return (
    <div
      className={`bull-backdrop ${useStack ? "is-depth-stack" : ""} ${className}`.trim()}
      data-fit={fit}
      data-depth-stack={useStack ? "true" : "false"}
      aria-hidden="true"
    >
      <img
        className={`bull-backdrop-img${ready ? " is-ready" : ""}`}
        src={plateUrl}
        alt=""
        draggable={false}
        onLoad={() => setReady(true)}
      />
      {useStack ? (
        <img
          className={`bull-backdrop-overlay${overlayReady ? " is-ready" : ""}`}
          src={overlaySrc}
          alt=""
          draggable={false}
          style={overlayStyle}
          onLoad={() => setOverlayReady(true)}
        />
      ) : null}
    </div>
  );
}
