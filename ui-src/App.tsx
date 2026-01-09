import { useState, useEffect, useCallback, useRef } from "react";
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

interface TextStyleInfo {
  id: string;
  name: string;
  fontFamily: string;
  fontStyle: string;
  fontSize: number;
}

type ScanScope = "selection" | "page" | "document";

// Simple Dropdown component
interface DropdownProps {
  value: string;
  options: string[];
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
  hasChanged?: boolean;
}

function Dropdown({ value, options, onChange, placeholder, className = "", hasChanged = false }: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const filteredOptions = searchTerm
    ? options.filter((opt) => opt.toLowerCase().includes(searchTerm.toLowerCase()))
    : options;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearchTerm("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    if (!isOpen) setIsOpen(true);
  };

  const handleSelect = (opt: string) => {
    onChange(opt);
    setSearchTerm("");
    setIsOpen(false);
  };

  const handleInputFocus = () => {
    setIsOpen(true);
    setSearchTerm("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && filteredOptions.length > 0) {
      handleSelect(filteredOptions[0]);
    } else if (e.key === "Escape") {
      setIsOpen(false);
      setSearchTerm("");
    }
  };

  return (
    <div className={`dropdown ${className} ${hasChanged ? "changed" : ""}`} ref={dropdownRef}>
      <div className="input-wrapper" onClick={() => !isOpen && setIsOpen(true)}>
        <input
          ref={inputRef}
          type="text"
          className="font-input"
          placeholder={placeholder}
          value={isOpen ? searchTerm : value}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onKeyDown={handleKeyDown}
        />
        <svg className={`chevron ${isOpen ? "open" : ""}`} viewBox="0 0 8 5" fill="none">
          <path d="M1 1L4 4L7 1" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      {isOpen && (
        <div className="dropdown-menu">
          {filteredOptions.length === 0 ? (
            <div className="dropdown-empty">No matches found</div>
          ) : (
            <>
              {filteredOptions.slice(0, 50).map((opt) => (
                <div
                  key={opt}
                  className={`dropdown-item ${opt === value ? "selected" : ""}`}
                  onClick={() => handleSelect(opt)}
                >
                  {opt}
                </div>
              ))}
              {filteredOptions.length > 50 && (
                <div className="dropdown-more">+{filteredOptions.length - 50} more</div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function App() {
  const [scope, setScope] = useState<ScanScope>("page");
  const [fonts, setFonts] = useState<FontInfo[]>([]);
  const [mappings, setMappings] = useState<FontMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [replacing, setReplacing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Available fonts
  const [availableFonts, setAvailableFonts] = useState<string[]>([]);
  const [availableStyles, setAvailableStyles] = useState<Record<string, string[]>>({});
  const [commonStyles, setCommonStyles] = useState<string[]>([]);
  const [textStyles, setTextStyles] = useState<TextStyleInfo[]>([]);

  // "Apply to all" mode
  const [applyToAllFamily, setApplyToAllFamily] = useState("");
  const [applyToAllStyle, setApplyToAllStyle] = useState("");

  // Derived state
  const changedCount = mappings.filter(
    (m) => m.selected && (m.newFamily !== m.oldFamily || m.newStyle !== m.oldStyle)
  ).length;

  const getStylesForFamily = (family: string): string[] => {
    if (availableStyles[family]) return availableStyles[family];
    return commonStyles;
  };

  // Listen for messages
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const msg = event.data.pluginMessage;
      if (!msg) return;

      if (msg.type === "scan-result") {
        setFonts(msg.fonts);
        setMappings(
          msg.fonts.map((f: FontInfo) => ({
            oldFamily: f.family,
            oldStyle: f.style,
            newFamily: f.family,
            newStyle: f.style,
            selected: true,
          }))
        );
        setLoading(false);
        setError(null);
        if (msg.availableFonts) setAvailableFonts(msg.availableFonts);
        if (msg.availableStyles) setAvailableStyles(msg.availableStyles);
        if (msg.commonStyles) setCommonStyles(msg.commonStyles);
        if (msg.textStyles) setTextStyles(msg.textStyles);
      }

      if (msg.type === "scan-error") {
        setError(msg.error);
        setLoading(false);
      }

      if (msg.type === "progress") {
        setProgress(msg.progress);
      }

      if (msg.type === "replace-result" || msg.type === "apply-style-result") {
        setReplacing(false);
        setProgress(0);
        if (msg.success || msg.applied > 0) {
          handleRescan();
        } else if (msg.errors?.length > 0) {
          setError(msg.errors.join(", "));
        }
      }

      if (msg.type === "replace-error" || msg.type === "apply-style-error") {
        setReplacing(false);
        setProgress(0);
        setError(msg.error);
      }

      if (msg.type === "create-style-result" && msg.success) {
        handleRescan();
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const handleRescan = useCallback(() => {
    setLoading(true);
    setError(null);
    parent.postMessage({ pluginMessage: { type: "scan-fonts", scope } }, "*");
  }, [scope]);

  useEffect(() => {
    handleRescan();
  }, [scope]);

  const handleReplace = () => {
    const toReplace = mappings
      .filter((m) => m.selected && (m.newFamily !== m.oldFamily || m.newStyle !== m.oldStyle))
      .map((m) => ({
        oldFamily: m.oldFamily,
        oldStyle: m.oldStyle,
        newFamily: m.newFamily,
        newStyle: m.newStyle,
      }));

    if (toReplace.length === 0) return;

    setReplacing(true);
    setProgress(0);
    setError(null);
    parent.postMessage({ pluginMessage: { type: "replace-fonts", scope, mappings: toReplace } }, "*");
  };

  const handleFamilyChange = (index: number, family: string) => {
    const newMappings = [...mappings];
    newMappings[index] = { ...newMappings[index], newFamily: family };
    setMappings(newMappings);
  };

  const handleStyleChange = (index: number, style: string) => {
    const newMappings = [...mappings];
    newMappings[index] = { ...newMappings[index], newStyle: style };
    setMappings(newMappings);
  };

  const handleSelectFont = (family: string, style: string) => {
    parent.postMessage({ pluginMessage: { type: "select-font", family, style, scope } }, "*");
  };

  const handleApplyToAll = () => {
    if (!applyToAllFamily) return;
    const newMappings = mappings.map((m) => ({
      ...m,
      newFamily: applyToAllFamily,
      newStyle: applyToAllStyle || getStylesForFamily(applyToAllFamily)[0] || m.oldStyle,
    }));
    setMappings(newMappings);
  };

  const handleReset = () => {
    setMappings(
      fonts.map((f) => ({
        oldFamily: f.family,
        oldStyle: f.style,
        newFamily: f.family,
        newStyle: f.style,
        selected: true,
      }))
    );
    setApplyToAllFamily("");
    setApplyToAllStyle("");
  };

  // Find matching text style for a font
  const getMatchingStyle = (family: string, style: string) => {
    return textStyles.find((s) => s.fontFamily === family && s.fontStyle === style);
  };

  const handleCreateTextStyle = (family: string, style: string) => {
    parent.postMessage({ pluginMessage: { type: "create-text-style", family, style } }, "*");
  };

  const isProcessing = loading || replacing;

  return (
    <div className="app">
      {/* Header */}
      <div className="header">
        <div className="header-title">
          <span className="title">Fonts in {scope}</span>
          <span className="count">{fonts.length} found</span>
        </div>
        <div className="scope-tabs">
          {(["page", "selection", "document"] as ScanScope[]).map((s) => (
            <button
              key={s}
              className={`scope-tab ${scope === s ? "active" : ""}`}
              onClick={() => setScope(s)}
              disabled={isProcessing}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Quick Actions Bar */}
      {!isProcessing && fonts.length > 0 && (
        <div className="quick-actions">
          <span className="quick-label">Replace all with:</span>
          <Dropdown
            value={applyToAllFamily}
            options={availableFonts}
            onChange={(v) => {
              setApplyToAllFamily(v);
              setApplyToAllStyle(getStylesForFamily(v)[0] || "");
            }}
            placeholder="Font family"
            className="quick-dropdown"
          />
          <Dropdown
            value={applyToAllStyle}
            options={applyToAllFamily ? getStylesForFamily(applyToAllFamily) : commonStyles}
            onChange={setApplyToAllStyle}
            placeholder="Style"
            className="quick-dropdown style"
          />
          <button
            className="quick-apply-btn"
            onClick={handleApplyToAll}
            disabled={!applyToAllFamily}
          >
            Apply
          </button>
          {changedCount > 0 && (
            <button className="reset-btn" onClick={handleReset} title="Reset all changes">
              Reset
            </button>
          )}
        </div>
      )}

      {/* Font List */}
      <div className="font-list">
        {loading && (
          <div className="state-message">
            <div className="spinner" />
            <span>Scanning fonts...</span>
          </div>
        )}

        {replacing && (
          <div className="state-message">
            <div className="spinner" />
            <span>Replacing... {progress > 0 && `${progress}%`}</span>
          </div>
        )}

        {!isProcessing && error && (
          <div className="state-message error">
            <span>⚠️ {error}</span>
            <button className="link-btn" onClick={handleRescan}>Try again</button>
          </div>
        )}

        {!isProcessing && !error && fonts.length === 0 && (
          <div className="state-message">
            <span>No text found in {scope}.</span>
            <span className="hint">Try a different scope above.</span>
          </div>
        )}

        {!isProcessing && !error && fonts.map((font, index) => {
          const mapping = mappings[index];
          const hasChanged = mapping && (mapping.newFamily !== mapping.oldFamily || mapping.newStyle !== mapping.oldStyle);
          const matchingStyle = getMatchingStyle(font.family, font.style);

          return (
            <div className={`font-row ${hasChanged ? "changed" : ""}`} key={`${font.family}-${font.style}`}>
              {/* Original font */}
              <div className="font-original">
                <button
                  className="select-btn"
                  onClick={() => handleSelectFont(font.family, font.style)}
                  title="Select layers with this font"
                >
                  <svg viewBox="0 0 16 16" fill="none">
                    <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M8 2v2M8 12v2M2 8h2M12 8h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>
                <div className="font-details">
                  <span className="font-name" title={font.family}>{font.family}</span>
                  <span className="font-meta">
                    {font.style} · {font.count} {font.count === 1 ? "layer" : "layers"}
                    {matchingStyle && (
                      <span className="has-style" title={`Has style: ${matchingStyle.name}`}>●</span>
                    )}
                  </span>
                </div>
              </div>

              {/* Arrow */}
              <div className="arrow">→</div>

              {/* Replacement */}
              <div className="font-replacement">
                <Dropdown
                  value={mapping?.newFamily ?? font.family}
                  options={availableFonts}
                  onChange={(val) => handleFamilyChange(index, val)}
                  placeholder="Font"
                  hasChanged={mapping?.newFamily !== mapping?.oldFamily}
                />
                <Dropdown
                  value={mapping?.newStyle ?? font.style}
                  options={getStylesForFamily(mapping?.newFamily ?? font.family)}
                  onChange={(val) => handleStyleChange(index, val)}
                  placeholder="Style"
                  className="style"
                  hasChanged={mapping?.newStyle !== mapping?.oldStyle}
                />
              </div>

              {/* Actions */}
              <div className="row-actions">
                {!matchingStyle && (
                  <button
                    className="create-style-btn"
                    onClick={() => handleCreateTextStyle(font.family, font.style)}
                    title="Create text style"
                  >
                    +S
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="footer">
        <button className="secondary-btn" onClick={handleRescan} disabled={isProcessing}>
          <svg viewBox="0 0 16 16" fill="none" className="icon">
            <path d="M13.65 2.35A8 8 0 1 0 16 8h-2a6 6 0 1 1-1.76-4.24L10 6h6V0l-2.35 2.35z" fill="currentColor" />
          </svg>
          Rescan
        </button>
        <div className="footer-info">
          {changedCount > 0 && <span className="change-count">{changedCount} to replace</span>}
        </div>
        <button
          className="primary-btn"
          onClick={handleReplace}
          disabled={isProcessing || changedCount === 0}
        >
          {replacing ? "Replacing..." : "Replace Fonts"}
        </button>
      </div>
    </div>
  );
}

export default App;
