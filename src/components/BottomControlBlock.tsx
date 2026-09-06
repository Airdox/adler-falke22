/**
 * @license
 * Rekordbox BottomControlBlock Component
 * 
 * Interactive collapsible & unfolding tool dock:
 * - When NO selection is active: folds down to an elegant, compact standby bar (maximizing viewport)
 *   with quick Beat selectors (1-32B), global Undo/Redo/Paste, and guidance.
 * - When a SELECTION IS ACTIVE: automatically unfolds smoothly with motion animation into the full
 *   suite of tools:
 *   - BEAT SELECT (1, 2, 4, 8, 16, 32, 64, 128)
 *   - SELECT MODUS: 1/2 HALF, ×2 DOUBLE, ⊗ CANCEL (Deselect)
 *   - EDIT: CLONE, COPY, CUT, PASTE, INSERT, REPLACE, OVERDUB, DELETE, CLEAR, UNDO, REDO
 *   - HIGH-END RENDER ANIMATION TRIGGER: "Signal 1 ⊕ Signal 2 Rendern"
 * - When deselected: automatically collapses smoothly back to standby.
 */

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Copy,
  Scissors,
  PlusSquare,
  ClipboardPaste,
  ArrowRightLeft,
  Trash2,
  Brush,
  RotateCcw,
  RotateCw,
  XCircle,
  Layers,
  Repeat,
  Sparkles,
  Sliders,
  Maximize2,
  ChevronUp,
  ChevronDown
} from 'lucide-react';
import { SelectionRange } from '../types/rekordbox';

interface BottomControlBlockProps {
  selection: SelectionRange | null;
  onBeatSelect: (beats: number) => void;
  onHalfSelection: () => void;
  onDoubleSelection: () => void;
  onCancelSelection: () => void;
  onClone: () => void;
  onCopy: () => void;
  onCut?: () => void;
  onPaste: () => void;
  onInsert: () => void;
  onReplace: () => void;
  onOverdub: () => void;
  onDelete: () => void;
  onClear: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  hasClipboard: boolean;
  matchPitch?: boolean;
  onToggleMatchPitch?: (match: boolean) => void;
  targetKey?: string;
  onTriggerRenderAnimation?: () => void;
}

export const BottomControlBlock: React.FC<BottomControlBlockProps> = ({
  selection,
  onBeatSelect,
  onHalfSelection,
  onDoubleSelection,
  onCancelSelection,
  onClone,
  onCopy,
  onCut,
  onPaste,
  onInsert,
  onReplace,
  onOverdub,
  onDelete,
  onClear,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  hasClipboard,
  matchPitch = true,
  onToggleMatchPitch,
  targetKey,
  onTriggerRenderAnimation,
}) => {
  const hasSelection = selection !== null && selection.duration > 0;

  return (
    <div className="bg-[#0b0c10] border-t border-[#1a1c24] flex flex-col select-none z-20 overflow-hidden transition-all">
      {/* ─────────────────────────────────────────────────────────────
          STANDBY BAR (Shown when no selection is made, or header bar)
         ───────────────────────────────────────────────────────────── */}
      {!hasSelection ? (
        <div className="h-9 px-3 flex items-center justify-between text-xs bg-[#0e1015]">
          <div className="flex items-center space-x-3">
            {/* Chamfered Tab */}
            <div className="rb-tab-chamfer bg-[#181a22] text-neutral-400 text-[10px] font-bold px-3 py-1 tracking-wider uppercase flex items-center space-x-1.5">
              <Sliders size={11} className="text-[#0088ff]" />
              <span>WERKZEUGE [STANDBY]</span>
            </div>

            {/* Hint message */}
            <span className="text-[11px] text-neutral-400 font-sans hidden md:inline">
              Bereich in der Waveform markieren oder Beat-Taste drücken, um Werkzeuge auszuklappen:
            </span>

            {/* Quick Beat Select triggers in Standby bar */}
            <div className="flex items-center space-x-1">
              {[1, 2, 4, 8, 16, 32].map((beats) => (
                <button
                  key={beats}
                  onClick={() => onBeatSelect(beats)}
                  className="px-2 py-0.5 rounded-xs bg-[#161922] hover:bg-[#0088ff] hover:text-white border border-[#232736] text-neutral-300 font-mono text-[10px] font-bold transition-all"
                  title={`${beats} Beat(s) ab Playhead selektieren`}
                >
                  {beats}B
                </button>
              ))}
            </div>
          </div>

          {/* Right Global Tools: Undo, Redo, Paste */}
          <div className="flex items-center space-x-2 text-xs">
            {hasClipboard && (
              <button
                onClick={onPaste}
                className="px-2 py-0.5 rounded-xs bg-[#182436] hover:bg-[#0088ff] hover:text-white border border-[#263c5c] text-[#00a2ff] text-[10.5px] font-medium flex items-center space-x-1 transition-colors"
                title="Zwischenablage am Playhead einfügen"
              >
                <ClipboardPaste size={12} />
                <span>Einfügen</span>
              </button>
            )}

            <button
              onClick={onUndo}
              disabled={!canUndo}
              className="p-1 rounded text-neutral-400 hover:text-white disabled:opacity-30 transition-colors"
              title="Rückgängig (Ctrl+Z)"
            >
              <RotateCcw size={13} />
            </button>
            <button
              onClick={onRedo}
              disabled={!canRedo}
              className="p-1 rounded text-neutral-400 hover:text-white disabled:opacity-30 transition-colors"
              title="Wiederholen (Ctrl+Y)"
            >
              <RotateCw size={13} />
            </button>
          </div>
        </div>
      ) : (
        /* ─────────────────────────────────────────────────────────────
           INTERACTIVE UNFOLDED TOOL DOCK (Active Selection)
           ───────────────────────────────────────────────────────────── */
        <motion.div
          initial={{ height: 36, opacity: 0.8 }}
          animate={{ height: 168, opacity: 1 }}
          exit={{ height: 36, opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="h-42 flex flex-col bg-[#0d0e13]"
        >
          {/* Top Bar: Selection telemetry & Cancel button */}
          <div className="h-6 bg-[#12141c] border-b border-[#1f222e] flex items-center justify-between px-3 text-xs">
            <div className="flex items-center space-x-3">
              <div className="rb-tab-chamfer bg-[#0088ff] text-white text-[10.5px] font-bold px-3 py-0.5 tracking-wider uppercase flex items-center space-x-1.5 shadow-sm">
                <Sliders size={11} />
                <span>SELEKTIONS-WERKZEUGE [AKTIV]</span>
              </div>

              {/* Exact Range Telemetry */}
              <div className="flex items-center space-x-2 text-[10.5px] font-mono text-neutral-300">
                <span>Bereich: <strong className="text-[#00e5ff]">{selection.start.toFixed(2)}s</strong> ➔ <strong className="text-[#00e5ff]">{selection.end.toFixed(2)}s</strong></span>
                <span className="text-neutral-600">•</span>
                <span>Dauer: <strong className="text-white">{selection.duration.toFixed(3)}s</strong></span>
                <span className="text-neutral-600">•</span>
                <span className="text-[#00ff9d] font-bold">
                  {Math.round(selection.beatsCount)} BEATS ({selection.barsCount.toFixed(1)} TAKTE)
                </span>
              </div>
            </div>

            {/* Cancel (Deselect) Button */}
            <button
              onClick={onCancelSelection}
              className="px-2 py-0.5 rounded-xs bg-[#241517] hover:bg-[#ff453a] text-[#ff6b6b] hover:text-white border border-[#442226] text-[10px] font-bold flex items-center space-x-1 transition-colors"
              title="Selektion aufheben (Deselektieren)"
            >
              <XCircle size={12} />
              <span>AUSWAHL AUFHEBEN</span>
            </button>
          </div>

          {/* Main Unfolded Tool Panels */}
          <div className="flex-1 flex overflow-hidden">
            {/* 1. BEAT SELECT Panel */}
            <div className="w-[300px] border-r border-[#1a1c25] flex flex-col p-2">
              <div className="text-[10px] text-neutral-400 font-bold tracking-wider uppercase mb-1 flex items-center justify-between">
                <span>BEAT SELECT</span>
                <span className="text-[9px] font-mono text-[#0088ff]">{selection.beatsCount.toFixed(1)} Beats</span>
              </div>
              <div className="grid grid-cols-4 grid-rows-2 gap-1.5 flex-1">
                {[1, 2, 4, 8, 16, 32, 64, 128].map((beats) => {
                  const isMatch = Math.round(selection.beatsCount) === beats;
                  return (
                    <button
                      key={beats}
                      onClick={() => onBeatSelect(beats)}
                      className={`rb-button-grid flex flex-col items-center justify-center rounded-xs transition-all ${
                        isMatch
                          ? 'border-[#0088ff] text-[#00a2ff] bg-[#162234] shadow-sm'
                          : 'text-neutral-300 hover:text-white'
                      }`}
                    >
                      <span className="text-[14px] font-mono font-bold leading-tight">{beats}</span>
                      <span className="text-[8.5px] font-semibold text-neutral-400 tracking-wider">BEAT</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. SELECT SCALING (1/2 HALF, ×2 DOUBLE) */}
            <div className="w-[180px] border-r border-[#1a1c25] flex flex-col p-2">
              <div className="text-[10px] text-neutral-400 font-bold tracking-wider uppercase mb-1">
                SKALIERUNG
              </div>
              <div className="grid grid-cols-2 gap-1.5 flex-1">
                <button
                  onClick={onHalfSelection}
                  className="rb-button-grid flex flex-col items-center justify-center rounded-xs"
                  title="Auswahl halbieren (1/2)"
                >
                  <span className="text-[14px] font-bold leading-tight">1/2</span>
                  <span className="text-[8.5px] font-semibold text-neutral-400 tracking-wider mt-0.5">HALF</span>
                </button>
                <button
                  onClick={onDoubleSelection}
                  className="rb-button-grid flex flex-col items-center justify-center rounded-xs"
                  title="Auswahl verdoppeln (×2)"
                >
                  <span className="text-[14px] font-bold leading-tight">× 2</span>
                  <span className="text-[8.5px] font-semibold text-neutral-400 tracking-wider mt-0.5">DOUBLE</span>
                </button>
              </div>
            </div>

            {/* 3. EDITIER-WERKZEUGE */}
            <div className="flex-1 flex flex-col p-2">
              <div className="flex items-center justify-between mb-1">
                <div className="text-[10px] text-neutral-400 font-bold tracking-wider uppercase">
                  EDITIER-OPERATIONEN
                </div>

                {/* Pitch adaptation Checkbox */}
                {onToggleMatchPitch && (
                  <label className="flex items-center space-x-1.5 cursor-pointer text-[10px] text-neutral-300 hover:text-white">
                    <input
                      type="checkbox"
                      checked={matchPitch}
                      onChange={(e) => onToggleMatchPitch(e.target.checked)}
                      className="w-3 h-3 rounded-xs accent-[#0088ff] cursor-pointer"
                    />
                    <span>Tonhöhe anpassen {targetKey ? `(${targetKey})` : ''}</span>
                  </label>
                )}
              </div>

              {/* Action Buttons Grid */}
              <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5 flex-1">
                {/* CLONE */}
                <button
                  onClick={onClone}
                  className="rb-button-grid flex flex-col items-center justify-center rounded-xs"
                  title="Auswahl klonen / zur Palette hinzufügen"
                >
                  <PlusSquare size={14} className="text-[#00a2ff]" />
                  <span className="text-[9px] font-semibold mt-1">CLONE</span>
                </button>

                {/* COPY */}
                <button
                  onClick={onCopy}
                  className="rb-button-grid flex flex-col items-center justify-center rounded-xs"
                  title="Kopieren (Ctrl+C)"
                >
                  <Copy size={14} />
                  <span className="text-[9px] font-semibold mt-1">COPY</span>
                </button>

                {/* CUT */}
                {onCut && (
                  <button
                    onClick={onCut}
                    className="rb-button-grid flex flex-col items-center justify-center rounded-xs"
                    title="Ausschneiden (Ctrl+X)"
                  >
                    <Scissors size={14} className="text-[#ff9500]" />
                    <span className="text-[9px] font-semibold mt-1">CUT</span>
                  </button>
                )}

                {/* INSERT */}
                <button
                  onClick={onInsert}
                  disabled={!hasClipboard}
                  className="rb-button-grid flex flex-col items-center justify-center rounded-xs"
                  title="Einfügen mit Zeittransformation"
                >
                  <ArrowRightLeft size={14} />
                  <span className="text-[9px] font-semibold mt-1">INSERT</span>
                </button>

                {/* REPLACE */}
                <button
                  onClick={onReplace}
                  className="rb-button-grid flex flex-col items-center justify-center rounded-xs text-[#ff9500] border-[#3d2e15]"
                  title="Bereich durch Clip/Clipboard ersetzen (Replace)"
                >
                  <Repeat size={14} />
                  <span className="text-[9px] font-semibold mt-1">REPLACE</span>
                </button>

                {/* OVERDUB (Signal 1 ⊕ 2 = 3) */}
                <button
                  onClick={onOverdub}
                  className="rb-button-grid flex flex-col items-center justify-center rounded-xs text-[#00ff9d] border-[#15462c]"
                  title="Signal 1 mit Signal 2 zusammensetzen (Overdub)"
                >
                  <Layers size={14} />
                  <span className="text-[9px] font-semibold mt-1">OVERDUB</span>
                </button>

                {/* DELETE */}
                <button
                  onClick={onDelete}
                  className="rb-button-grid flex flex-col items-center justify-center rounded-xs text-[#ff453a]"
                  title="Löschen mit Zeitanpassung"
                >
                  <Trash2 size={14} />
                  <span className="text-[9px] font-semibold mt-1">DELETE</span>
                </button>

                {/* CLEAR */}
                <button
                  onClick={onClear}
                  className="rb-button-grid flex flex-col items-center justify-center rounded-xs"
                  title="Stumm schalten / leeren"
                >
                  <Brush size={14} />
                  <span className="text-[9px] font-semibold mt-1">CLEAR</span>
                </button>
              </div>
            </div>

            {/* 4. HIGH-END RENDER & FX BUTTON */}
            {onTriggerRenderAnimation && (
              <div className="w-[170px] border-l border-[#1a1c25] p-2 flex flex-col justify-center">
                <button
                  onClick={onTriggerRenderAnimation}
                  className="w-full h-full rounded-xs bg-gradient-to-b from-[#14233a] to-[#0f1929] hover:from-[#1b3152] hover:to-[#14243b] border border-[#23426e] text-[#00e5ff] flex flex-col items-center justify-center p-2 text-center transition-all shadow-md group"
                  title="High-End 3D Multi-Schichten Render-Studio öffnen"
                >
                  <Sparkles size={18} className="text-[#00ff9d] group-hover:scale-110 transition-transform mb-1" />
                  <span className="text-[10px] font-bold text-white tracking-tight">
                    Render-Studio
                  </span>
                  <span className="text-[8.5px] font-mono text-[#00ff9d] mt-0.5">
                    Signal 1 ⊕ 2 = 3
                  </span>
                </button>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
};
