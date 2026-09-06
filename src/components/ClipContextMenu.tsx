/**
 * @license
 * Rekordbox Clip Context Menu Component
 * High-end context menu triggered via right-click on any clip or clip waveform.
 * Provides all essential Pioneer Rekordbox producer & DJ editing actions:
 * - Play preview / Cue reset
 * - Transfer actions to Deck A: Insert @ Playhead, Replace Selection, Overdub (1+2=3)
 * - 3D Multi-Layer Render Studio launch
 * - Expand to Deck B / Detail Waveform
 * - File operations: Rename, Duplicate, Export as WAV
 * - Delete from library
 */

import React, { useEffect, useRef, useState } from 'react';
import { PaletteClip } from '../types/rekordbox';
import {
  Play,
  Square,
  RotateCcw,
  Plus,
  Repeat,
  Layers,
  Sparkles,
  Maximize2,
  Edit2,
  Copy,
  Download,
  Trash2,
  Clock,
  Music,
  Check,
  X,
  Volume2,
} from 'lucide-react';

export interface ClipContextMenuProps {
  isOpen: boolean;
  position: { x: number; y: number };
  clip: PaletteClip;
  onClose: () => void;
  isPlayingPreview?: boolean;
  onTogglePreview?: () => void;
  onInsertToDeckA?: () => void;
  onReplaceInDeckA?: () => void;
  onOverdubInDeckA?: () => void;
  onOpenRenderStudio?: () => void;
  onOpenInDeckB?: () => void;
  onRename?: (newName: string) => void;
  onDuplicate?: () => void;
  onDownloadWav?: () => void;
  onDelete?: () => void;
  hasDeckASelection?: boolean;
  timeAtClick?: number;
  onSeekToTime?: (time: number) => void;
}

export const ClipContextMenu: React.FC<ClipContextMenuProps> = ({
  isOpen,
  position,
  clip,
  onClose,
  isPlayingPreview = false,
  onTogglePreview,
  onInsertToDeckA,
  onReplaceInDeckA,
  onOverdubInDeckA,
  onOpenRenderStudio,
  onOpenInDeckB,
  onRename,
  onDuplicate,
  onDownloadWav,
  onDelete,
  hasDeckASelection = false,
  timeAtClick,
  onSeekToTime,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameText, setRenameText] = useState(clip.name);

  useEffect(() => {
    setRenameText(clip.name);
    setIsRenaming(false);
  }, [clip.id, clip.name, isOpen]);

  // Close on outside click or escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleMouseDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Safe viewport positioning clamping
  const menuWidth = 260;
  const menuHeight = 440;
  const clampedX = Math.min(Math.max(8, position.x), window.innerWidth - menuWidth - 10);
  const clampedY = Math.min(Math.max(8, position.y), window.innerHeight - menuHeight - 10);

  const handleConfirmRename = () => {
    if (renameText.trim() && onRename) {
      onRename(renameText.trim());
    }
    setIsRenaming(false);
    onClose();
  };

  return (
    <div
      ref={menuRef}
      id="clip-context-menu"
      style={{
        left: `${clampedX}px`,
        top: `${clampedY}px`,
      }}
      className="fixed z-[9999] w-[260px] bg-[#12141a]/95 backdrop-blur-md border border-[#282c3a] shadow-2xl rounded-xs py-1 text-neutral-200 text-[11px] select-none font-sans"
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      {/* Header with Clip Info */}
      <div className="px-3 py-2 border-b border-[#20232e] bg-[#0c0d12]">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center space-x-1.5 truncate">
            <Music size={12} className="text-[#00e5ff] flex-shrink-0" />
            <span className="font-bold text-white truncate text-[11.5px]" title={clip.name}>
              {clip.name}
            </span>
          </div>
          <span className="text-[9px] bg-[#0088ff]/20 text-[#00a2ff] border border-[#0088ff]/40 px-1 py-0.5 rounded font-mono font-bold flex-shrink-0">
            CLIP
          </span>
        </div>

        {/* Metadata stats */}
        <div className="flex items-center justify-between text-[10px] text-neutral-400 font-mono">
          <span>{clip.bpm.toFixed(1)} BPM</span>
          <span className="text-[#00ff9d] font-bold">{clip.key}</span>
          <span>{clip.duration.toFixed(2)}s ({clip.beats} Beats)</span>
        </div>
      </div>

      {/* Inline Rename Mode */}
      {isRenaming ? (
        <div className="p-2 border-b border-[#20232e] bg-[#181b24]">
          <div className="text-[10px] text-neutral-400 mb-1 font-semibold">Clip umbenennen:</div>
          <div className="flex items-center space-x-1">
            <input
              type="text"
              value={renameText}
              onChange={(e) => setRenameText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleConfirmRename();
                if (e.key === 'Escape') setIsRenaming(false);
              }}
              autoFocus
              className="flex-1 bg-[#0d0e13] border border-[#0088ff] text-white px-2 py-1 text-[11px] rounded-xs outline-none"
            />
            <button
              onClick={handleConfirmRename}
              className="p-1 bg-[#0088ff] text-white rounded-xs hover:bg-[#0077dd]"
              title="Speichern"
            >
              <Check size={12} />
            </button>
            <button
              onClick={() => setIsRenaming(false)}
              className="p-1 bg-[#262832] text-neutral-400 rounded-xs hover:text-white"
              title="Abbrechen"
            >
              <X size={12} />
            </button>
          </div>
        </div>
      ) : null}

      {/* Group: Time & Waveform specific action if clicked on waveform */}
      {timeAtClick !== undefined && onSeekToTime && (
        <>
          <button
            onClick={() => {
              onSeekToTime(timeAtClick);
              onClose();
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-[#0088ff] hover:text-white flex items-center justify-between transition-colors"
          >
            <span className="flex items-center space-x-2">
              <Clock size={12} className="text-[#00e5ff]" />
              <span>Playhead hierher setzen</span>
            </span>
            <span className="text-[10px] font-mono text-neutral-400">{timeAtClick.toFixed(2)}s</span>
          </button>
          <div className="h-px bg-[#20232e] my-1" />
        </>
      )}

      {/* Group 1: Preview & Playback */}
      <div className="py-0.5">
        {onTogglePreview && (
          <button
            onClick={() => {
              onTogglePreview();
              onClose();
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-[#0088ff] hover:text-white flex items-center justify-between transition-colors"
          >
            <span className="flex items-center space-x-2">
              {isPlayingPreview ? (
                <Square size={12} className="text-[#ff3b30]" fill="currentColor" />
              ) : (
                <Play size={12} className="text-[#00ff9d]" fill="currentColor" />
              )}
              <span className={isPlayingPreview ? 'text-[#ff3b30] font-bold' : ''}>
                {isPlayingPreview ? 'Vorhören beenden' : 'Vorhören abspielen'}
              </span>
            </span>
            <span className="text-[9.5px] font-mono text-neutral-400">Space</span>
          </button>
        )}
      </div>

      <div className="h-px bg-[#20232e] my-1" />

      {/* Group 2: Transfer to Deck A */}
      <div className="py-0.5">
        <div className="px-3 py-0.5 text-[9px] font-bold text-neutral-400 uppercase tracking-wider">
          In Deck A übertragen
        </div>

        {onInsertToDeckA && (
          <button
            onClick={() => {
              onInsertToDeckA();
              onClose();
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-[#0088ff] hover:text-white flex items-center justify-between transition-colors text-white"
          >
            <span className="flex items-center space-x-2">
              <Plus size={12} className="text-[#00e5ff]" />
              <span>Am Playhead einfügen (Insert)</span>
            </span>
            <span className="text-[9.5px] font-mono text-[#00e5ff]">Shift+V</span>
          </button>
        )}

        {onReplaceInDeckA && (
          <button
            onClick={() => {
              onReplaceInDeckA();
              onClose();
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-[#0088ff] hover:text-white flex items-center justify-between transition-colors text-[#ff9500]"
          >
            <span className="flex items-center space-x-2">
              <Repeat size={12} className="text-[#ff9500]" />
              <span>{hasDeckASelection ? 'Auswahl ersetzen (Replace)' : 'Ab Playhead ersetzen'}</span>
            </span>
            <span className="text-[9.5px] font-mono text-[#ff9500]">R</span>
          </button>
        )}

        {onOverdubInDeckA && (
          <button
            onClick={() => {
              onOverdubInDeckA();
              onClose();
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-[#0088ff] hover:text-white flex items-center justify-between transition-colors text-[#00ff9d]"
          >
            <span className="flex items-center space-x-2">
              <Layers size={12} className="text-[#00ff9d]" />
              <span>Überlagern / Superposition (1+2=3)</span>
            </span>
            <span className="text-[9.5px] font-mono text-[#00ff9d]">O</span>
          </button>
        )}

        {onOpenRenderStudio && (
          <button
            onClick={() => {
              onOpenRenderStudio();
              onClose();
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-[#0088ff] hover:text-white flex items-center justify-between transition-colors text-[#00e5ff] font-medium"
          >
            <span className="flex items-center space-x-2">
              <Sparkles size={12} className="text-[#00e5ff]" />
              <span>3D Render-Studio öffnen...</span>
            </span>
            <span className="text-[9px] bg-[#00e5ff]/20 text-[#00e5ff] px-1 rounded font-mono font-bold">
              3D
            </span>
          </button>
        )}
      </div>

      <div className="h-px bg-[#20232e] my-1" />

      {/* Group 3: View & Deck B */}
      <div className="py-0.5">
        {onOpenInDeckB && (
          <button
            onClick={() => {
              onOpenInDeckB();
              onClose();
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-[#0088ff] hover:text-white flex items-center justify-between transition-colors"
          >
            <span className="flex items-center space-x-2">
              <Maximize2 size={12} className="text-neutral-400" />
              <span>In Deck B (Clip-Ansicht) öffnen</span>
            </span>
            <span className="text-[9.5px] font-mono text-neutral-400">Deck B</span>
          </button>
        )}
      </div>

      <div className="h-px bg-[#20232e] my-1" />

      {/* Group 4: File & Clip Operations */}
      <div className="py-0.5">
        <button
          onClick={() => setIsRenaming(true)}
          className="w-full text-left px-3 py-1.5 hover:bg-[#0088ff] hover:text-white flex items-center justify-between transition-colors"
        >
          <span className="flex items-center space-x-2">
            <Edit2 size={12} className="text-neutral-400" />
            <span>Clip umbenennen...</span>
          </span>
          <span className="text-[9.5px] font-mono text-neutral-400">F2</span>
        </button>

        {onDuplicate && (
          <button
            onClick={() => {
              onDuplicate();
              onClose();
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-[#0088ff] hover:text-white flex items-center justify-between transition-colors"
          >
            <span className="flex items-center space-x-2">
              <Copy size={12} className="text-neutral-400" />
              <span>Clip duplizieren</span>
            </span>
            <span className="text-[9.5px] font-mono text-neutral-400">Klonen</span>
          </button>
        )}

        {onDownloadWav && (
          <button
            onClick={() => {
              onDownloadWav();
              onClose();
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-[#0088ff] hover:text-white flex items-center justify-between transition-colors"
          >
            <span className="flex items-center space-x-2">
              <Download size={12} className="text-[#00ff9d]" />
              <span>Als WAV exportieren (.wav)</span>
            </span>
            <span className="text-[9.5px] font-mono text-[#00ff9d]">WAV</span>
          </button>
        )}
      </div>

      <div className="h-px bg-[#20232e] my-1" />

      {/* Group 5: Danger Zone */}
      {onDelete && (
        <div className="py-0.5">
          <button
            onClick={() => {
              onDelete();
              onClose();
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-[#ff3b30] hover:text-white flex items-center justify-between transition-colors text-[#ff453a]"
          >
            <span className="flex items-center space-x-2">
              <Trash2 size={12} />
              <span>Aus Bibliothek löschen</span>
            </span>
            <span className="text-[9.5px] font-mono">Entf</span>
          </button>
        </div>
      )}
    </div>
  );
};
