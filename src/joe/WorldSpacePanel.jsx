import {
  DEFAULT_WORLD,
  WORLD_CONTROL_DEFS,
  WORLD_PRESETS,
  clampWorld,
} from "./wizardJoeWorldSpace.js";

/**
 * Robin/Prism-style world-space control surface for Wizard Joe.
 */
export function WorldSpacePanel({ world, onChange, onReset }) {
  const w = clampWorld(world || DEFAULT_WORLD);

  const set = (id, value) => {
    onChange?.(clampWorld({ ...w, [id]: value }));
  };

  return (
    <div className="wj-world" aria-label="World space controls">
      <div className="wj-world-head">
        <div>
          <strong>World space</strong>
          <p>Same stage language as Robin — pan, zoom, spin, tilt.</p>
        </div>
        <button type="button" className="wj-chip" onClick={() => onReset?.()}>
          Reset
        </button>
      </div>

      <div className="wj-world-presets">
        {WORLD_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            className="wj-chip"
            onClick={() => onChange?.(clampWorld({ ...w, ...p.world }))}
          >
            {p.label}
          </button>
        ))}
        <button
          type="button"
          className={`wj-chip${w.flipX ? " is-on" : ""}`}
          onClick={() => set("flipX", !w.flipX)}
        >
          Flip X {w.flipX ? "on" : "off"}
        </button>
      </div>

      <div className="wj-world-sliders">
        {WORLD_CONTROL_DEFS.map((def) => (
          <label key={def.id} className="wj-world-slider">
            <span>
              {def.label}
              <em>
                {typeof w[def.id] === "number"
                  ? Number(w[def.id]).toFixed(def.step < 0.1 ? 2 : 1)
                  : w[def.id]}
              </em>
            </span>
            <input
              type="range"
              min={def.min}
              max={def.max}
              step={def.step}
              value={w[def.id]}
              onChange={(e) => set(def.id, Number(e.target.value))}
            />
          </label>
        ))}
      </div>
    </div>
  );
}
