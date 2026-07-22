import {
  PERFORMER_LABELS,
  PERFORMER_MODES,
} from "./performerModes.js";
import "./PerformerSwitch.css";

/**
 * Accessible performer switch — same cast set as RobinSpeech 41BirdLive.
 */
export function PerformerSwitch({ value, onChange, modes = PERFORMER_MODES }) {
  const list = Array.isArray(modes) && modes.length ? modes : PERFORMER_MODES;
  return (
    <div className="performer-switch" role="group" aria-label="Stage performer">
      {list.map((mode) => {
        const label = PERFORMER_LABELS[mode] || mode;
        const pressed = value === mode;
        return (
          <button
            key={mode}
            type="button"
            className={pressed ? "is-active" : ""}
            aria-pressed={pressed}
            aria-label={`Show ${label}`}
            title={label}
            onClick={() => {
              if (typeof onChange === "function" && mode !== value) onChange(mode);
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
