import "./StageFullscreenButton.css";

/**
 * Accessible full-screen toggle for character stages.
 */
export function StageFullscreenButton({ active, onToggle, className = "" }) {
  return (
    <button
      type="button"
      className={`stage-fs-btn${active ? " is-active" : ""} ${className}`.trim()}
      onClick={onToggle}
      aria-pressed={active}
      title={active ? "Exit full screen (Esc or F)" : "Full screen character stage (F)"}
      aria-label={active ? "Exit full screen" : "Enter full screen"}
    >
      {active ? (
        <span className="stage-fs-icon" aria-hidden="true">
          ⛶
        </span>
      ) : (
        <span className="stage-fs-icon" aria-hidden="true">
          ⛶
        </span>
      )}
      <span className="stage-fs-label">{active ? "Exit" : "Full screen"}</span>
    </button>
  );
}
