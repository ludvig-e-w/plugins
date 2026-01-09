import { useState, useEffect, useCallback } from "react";
import "./App.css";

// Types
interface FontInfo {
  family: string;
  style: string;
  count: number;
}

interface FontMapping {
  oldFamily: string;
  oldStyle: string;
  newFamily: string;
  newStyle: string;
  selected: boolean;
}

type ScanScope = "selection" | "page" | "document";

function App() {
  const [scope, setScope] = useState<ScanScope>("page");
  const [fonts, setFonts] = useState<FontInfo[]>([]);
  const [mappings, setMappings] = useState<FontMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [replacing, setReplacing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Derived state
  const allSelected = mappings.length > 0 && mappings.every((m) => m.selected);
  const someSelected = mappings.some((m) => m.selected);
  const hasChanges = mappings.some(
    (m) => m.selected && (m.newFamily !== m.oldFamily || m.newStyle !== m.oldStyle)
  );

  // Listen for messages from the plugin
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const msg = event.data.pluginMessage;
      if (!msg) return;

      if (msg.type === "scan-result") {
        const scannedFonts: FontInfo[] = msg.fonts;
        setFonts(scannedFonts);
        setMappings(
          scannedFonts.map((f) => ({
            oldFamily: f.family,
            oldStyle: f.style,
            newFamily: f.family,
            newStyle: f.style,
            selected: true,
          }))
        );
        setLoading(false);
        setError(null);
      }

      if (msg.type === "scan-error") {
        setError(msg.error);
        setLoading(false);
      }

      if (msg.type === "progress") {
        setProgress(msg.progress);
      }

      if (msg.type === "replace-result") {
        setReplacing(false);
        setProgress(0);
        if (msg.success) {
          // Refresh the font list
          handleParse();
        } else if (msg.errors?.length > 0) {
          setError(msg.errors.join(", "));
        }
      }

      if (msg.type === "replace-error") {
        setReplacing(false);
        setProgress(0);
        setError(msg.error);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  // Parse/Scan fonts
  const handleParse = useCallback(() => {
    setLoading(true);
    setError(null);
    parent.postMessage({ pluginMessage: { type: "scan-fonts", scope } }, "*");
  }, [scope]);

  // Trigger parse when scope changes
  useEffect(() => {
    handleParse();
  }, [scope]);

  // Change fonts
  const handleChangeFonts = () => {
    const selectedMappings = mappings
      .filter((m) => m.selected && (m.newFamily !== m.oldFamily || m.newStyle !== m.oldStyle))
      .map((m) => ({
        oldFamily: m.oldFamily,
        oldStyle: m.oldStyle,
        newFamily: m.newFamily,
        newStyle: m.newStyle,
      }));

    if (selectedMappings.length === 0) return;

    setReplacing(true);
    setProgress(0);
    setError(null);
    parent.postMessage(
      { pluginMessage: { type: "replace-fonts", scope, mappings: selectedMappings } },
      "*"
    );
  };

  // Toggle select all
  const handleSelectAll = () => {
    const newValue = !allSelected;
    setMappings(mappings.map((m) => ({ ...m, selected: newValue })));
  };

  // Toggle individual font
  const handleToggleFont = (index: number) => {
    const newMappings = [...mappings];
    newMappings[index] = { ...newMappings[index], selected: !newMappings[index].selected };
    setMappings(newMappings);
  };

  // Update target font family
  const handleFamilyChange = (index: number, family: string) => {
    const newMappings = [...mappings];
    newMappings[index] = { ...newMappings[index], newFamily: family };
    setMappings(newMappings);
  };

  // Update target font style
  const handleStyleChange = (index: number, style: string) => {
    const newMappings = [...mappings];
    newMappings[index] = { ...newMappings[index], newStyle: style };
    setMappings(newMappings);
  };

  const isProcessing = loading || replacing;

  return (
    <div className="app">
      {/* Header Row */}
      <div className="header-row">
        <input
          type="checkbox"
          className="checkbox"
          checked={allSelected}
          ref={(el) => {
            if (el) el.indeterminate = someSelected && !allSelected;
          }}
          onChange={handleSelectAll}
          disabled={fonts.length === 0}
        />
        <span className="title">Current fonts</span>
        <span className="count">({fonts.length})</span>
        <span className="replace-label">Replace with</span>
      </div>

      {/* Font List */}
      <div className="font-list">
        {loading && (
          <div className="loading">
            <div className="spinner"></div>
            <span>Scanning fonts...</span>
          </div>
        )}

        {replacing && (
          <div className="loading">
            <div className="spinner"></div>
            <span>Replacing fonts... {progress > 0 ? `${progress}%` : ""}</span>
          </div>
        )}

        {!isProcessing && error && (
          <div className="error-state">
            <div className="icon">⚠️</div>
            <p>{error}</p>
            <button className="retry-btn" onClick={handleParse}>
              Retry
            </button>
          </div>
        )}

        {!isProcessing && !error && fonts.length === 0 && (
          <div className="empty-state">
            <div className="icon">📝</div>
            <p>No text layers found in current {scope}.</p>
            <p className="hint">Try selecting a different scope or make a selection.</p>
          </div>
        )}

        {!isProcessing &&
          !error &&
          fonts.map((font, index) => (
            <div
              className={`font-row ${mappings[index]?.selected ? "selected" : ""}`}
              key={`${font.family}-${font.style}`}
            >
              <input
                type="checkbox"
                className="checkbox"
                checked={mappings[index]?.selected ?? true}
                onChange={() => handleToggleFont(index)}
              />
              <div className="font-info">
                <span className="font-name" title={font.family}>
                  {font.family}
                </span>
                <span className="font-style">{font.style}</span>
              </div>
              <div className="replace-section">
                <div className="input-wrapper">
                  <input
                    type="text"
                    className="font-input"
                    placeholder="Font family"
                    value={mappings[index]?.newFamily ?? font.family}
                    onChange={(e) => handleFamilyChange(index, e.target.value)}
                  />
                  <svg className="chevron" viewBox="0 0 8 5" fill="none">
                    <path d="M1 1L4 4L7 1" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div className="input-wrapper style-input">
                  <input
                    type="text"
                    className="font-input"
                    placeholder="Style"
                    value={mappings[index]?.newStyle ?? font.style}
                    onChange={(e) => handleStyleChange(index, e.target.value)}
                  />
                  <svg className="chevron" viewBox="0 0 8 5" fill="none">
                    <path d="M1 1L4 4L7 1" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              </div>
            </div>
          ))}
      </div>

      {/* Footer */}
      <div className="footer">
        {/* Scope Tabs */}
        <div className="scope-tabs">
          <button
            className={`scope-tab ${scope === "page" ? "active" : ""}`}
            onClick={() => setScope("page")}
            disabled={isProcessing}
          >
            Page
          </button>
          <button
            className={`scope-tab ${scope === "selection" ? "active" : ""}`}
            onClick={() => setScope("selection")}
            disabled={isProcessing}
          >
            Selection
          </button>
          <button
            className={`scope-tab ${scope === "document" ? "active" : ""}`}
            onClick={() => setScope("document")}
            disabled={isProcessing}
          >
            Document
          </button>
        </div>

        {/* Parse Button */}
        <button className="parse-btn" onClick={handleParse} disabled={isProcessing}>
          <svg className="refresh-icon" viewBox="0 0 16 16" fill="none">
            <path
              d="M13.65 2.35A8 8 0 1 0 16 8h-2a6 6 0 1 1-1.76-4.24L10 6h6V0l-2.35 2.35z"
              fill="currentColor"
            />
          </svg>
          Parse
        </button>

        {/* Links */}
        <div className="links">
          <a
            className="link"
            href="https://www.figma.com/plugin-docs/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Guide ↗
          </a>
          <a
            className="link"
            href="https://www.figma.com/community"
            target="_blank"
            rel="noopener noreferrer"
          >
            Community ↗
          </a>
        </div>

        {/* Change Fonts Button */}
        <button
          className="primary-btn"
          onClick={handleChangeFonts}
          disabled={isProcessing || !hasChanges}
        >
          {replacing ? "Replacing..." : "Change fonts"}
        </button>
      </div>
    </div>
  );
}

export default App;
