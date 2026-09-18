import { LED_COUNT, MAX_MODES } from "./config";
import type { Mode, ModeType } from "./types";
import {
  ModeTypeEditor,
  ModeTypeSelector,
  modeTypeShort,
} from "./components/ModeEditor";
import {
  changeModeType,
  cloneModes,
  createMode,
  defaultModes,
  hexToRgb,
  loadLocalModes,
  saveLocalModes,
} from "./modeUtils";
import { useEffect, useRef, useState } from "react";

import { LedStrip } from "./components/LedStrip";
import { MODE_TYPE_LABELS } from "./types";
import { useMqtt } from "./useMqtt";

export default function App() {
  const [username, setUsername] = useState(
    () => sessionStorage.getItem("mq_user") ?? "",
  );
  const [password, setPassword] = useState(
    () => sessionStorage.getItem("mq_pass") ?? "",
  );
  const [authed, setAuthed] = useState(
    !!(sessionStorage.getItem("mq_user") && sessionStorage.getItem("mq_pass")),
  );

  const [modes, setModes] = useState<Mode[]>(
    () => loadLocalModes() ?? defaultModes(),
  );
  const [activeModeIndex, setActiveModeIndex] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [brushColor, setBrushColor] = useState("#ffffff");
  const [showAddMenu, setShowAddMenu] = useState(false);
  const isPainting = useRef(false);
  const skipDirty = useRef(true);

  const { status, deviceStatus, retainedModes, publish } = useMqtt(
    authed ? username : "",
    authed ? password : "",
  );

  useEffect(() => {
    if (retainedModes) {
      skipDirty.current = true;
      setModes(cloneModes(retainedModes));
      setActiveModeIndex(0);
      setDirty(false);
      saveLocalModes(retainedModes);
    }
  }, [retainedModes]);

  useEffect(() => {
    saveLocalModes(modes);
    if (skipDirty.current) {
      skipDirty.current = false;
      return;
    }
    setDirty(true);
  }, [modes]);

  useEffect(() => {
    function stopPainting() {
      isPainting.current = false;
    }
    window.addEventListener("pointerup", stopPainting);
    window.addEventListener("pointercancel", stopPainting);
    return () => {
      window.removeEventListener("pointerup", stopPainting);
      window.removeEventListener("pointercancel", stopPainting);
    };
  }, []);

  function handleLogin(e: React.SyntheticEvent) {
    e.preventDefault();
    sessionStorage.setItem("mq_user", username);
    sessionStorage.setItem("mq_pass", password);
    setAuthed(true);
  }

  function updateMode(updater: (mode: Mode) => Mode) {
    setModes((prev) =>
      prev.map((mode, i) => (i === activeModeIndex ? updater(mode) : mode)),
    );
  }

  function paintLed(i: number) {
    if (!isPainting.current) return;
    const rgb = hexToRgb(brushColor);
    updateMode((mode) => {
      if (mode.type !== "static" || !mode.leds) return mode;
      const leds = [...mode.leds];
      leds[i] = rgb;
      return { ...mode, leds };
    });
  }

  function fillAll() {
    const rgb = hexToRgb(brushColor);
    updateMode((mode) =>
      mode.type === "static"
        ? { ...mode, leds: Array(LED_COUNT).fill(rgb) }
        : mode,
    );
  }

  function clearAll() {
    updateMode((mode) =>
      mode.type === "static"
        ? { ...mode, leds: Array(LED_COUNT).fill({ r: 0, g: 0, b: 0 }) }
        : mode,
    );
  }

  function addMode(type: ModeType) {
    if (modes.length >= MAX_MODES) return;
    setModes((prev) => [...prev, createMode(type, prev.length)]);
    setActiveModeIndex(modes.length);
    setShowAddMenu(false);
  }

  function removeMode(index: number) {
    if (modes.length <= 1) return;
    setModes((prev) => prev.filter((_, i) => i !== index));
    setActiveModeIndex((prev) =>
      prev >= index ? Math.max(0, prev - 1) : prev,
    );
  }

  const activeMode = modes[activeModeIndex];
  const { online, activeMode: deviceActiveMode } = deviceStatus;

  let deviceModeLabel = "unknown";
  if (online === false) deviceModeLabel = "offline";
  else if (online === true) {
    if (deviceActiveMode === null || deviceActiveMode === undefined)
      deviceModeLabel = "online";
    else if (deviceActiveMode < 0) deviceModeLabel = "off";
    else {
      const m = modes[deviceActiveMode];
      deviceModeLabel = m
        ? `${m.name} (${modeTypeShort(m.type)})`
        : `Mode ${deviceActiveMode + 1}`;
    }
  }

  if (!authed) {
    return (
      <div className="login">
        <h1>w-r</h1>
        <form onSubmit={handleLogin}>
          <input
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <input
            placeholder="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button type="submit">Connect</button>
        </form>
      </div>
    );
  }

  return (
    <div className="app">
      <header>
        <h1>w-r</h1>
        <div className="status">
          <span className={`dot ${status}`} />
          {status === "connected"
            ? `${online === null ? "device unknown" : online ? "device online" : "device offline"} · ${deviceModeLabel}`
            : status}
        </div>
      </header>

      <section className="mode-tabs-section">
        <div className="mode-tabs">
          {modes.map((mode, i) => (
            <button
              key={i}
              type="button"
              className={`mode-tab ${i === activeModeIndex ? "active" : ""} ${deviceActiveMode === i ? "live" : ""}`}
              onClick={() => setActiveModeIndex(i)}
            >
              <LedStrip mode={mode} compact />
              <span className="mode-tab-label">
                {mode.name || `Mode ${i + 1}`}
                <span className="mode-tab-type">
                  {modeTypeShort(mode.type)}
                </span>
              </span>
            </button>
          ))}
          {modes.length < MAX_MODES && (
            <div className="add-mode">
              <button
                type="button"
                className="mode-tab add"
                onClick={() => setShowAddMenu((v) => !v)}
              >
                +
              </button>
              {showAddMenu && (
                <div className="add-menu">
                  {(Object.keys(MODE_TYPE_LABELS) as ModeType[]).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => addMode(type)}
                    >
                      {MODE_TYPE_LABELS[type]}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      <section className="strip-section">
        <LedStrip
          mode={activeMode}
          editable={activeMode.type === "static"}
          onPaintStart={() => {
            isPainting.current = true;
          }}
          onPaintEnd={() => {
            isPainting.current = false;
          }}
          onPaint={(i) => paintLed(i)}
        />
      </section>

      <section className="mode-editor">
        <ModeTypeSelector
          mode={activeMode}
          onTypeChange={(type) =>
            updateMode((mode) => changeModeType(mode, type))
          }
        />

        <div className="mode-meta">
          <label className="field-row">
            Name
            <input
              type="text"
              value={activeMode.name}
              onChange={(e) =>
                updateMode((mode) => ({ ...mode, name: e.target.value }))
              }
            />
          </label>
          <label className="field-row">
            Brightness
            <input
              type="range"
              min={0}
              max={255}
              value={activeMode.brightness}
              onChange={(e) =>
                updateMode((mode) => ({ ...mode, brightness: +e.target.value }))
              }
            />
            <span className="range-value">{activeMode.brightness}</span>
          </label>
          {modes.length > 1 && (
            <button
              type="button"
              className="danger"
              onClick={() => removeMode(activeModeIndex)}
            >
              Remove mode
            </button>
          )}
        </div>

        <ModeTypeEditor
          mode={activeMode}
          brushColor={brushColor}
          onBrushColorChange={setBrushColor}
          onUpdate={updateMode}
          onTypeChange={(type) =>
            updateMode((mode) => changeModeType(mode, type))
          }
        />

        <div className="controls">
          {activeMode.type === "static" && (
            <div className="bulk">
              <button type="button" onClick={fillAll}>
                Fill all
              </button>
              <button type="button" onClick={clearAll}>
                Clear all
              </button>
            </div>
          )}
          <button
            type="button"
            className="apply"
            disabled={status !== "connected"}
            onClick={() => {
              publish(modes);
              skipDirty.current = true;
              setDirty(false);
            }}
          >
            {dirty ? "Apply all modes (unsaved to lamp)" : "Apply all modes"}
          </button>
          {dirty && status === "connected" && (
            <p className="save-hint">
              Changes saved in this browser. Click Apply to send them to the
              lamp.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
