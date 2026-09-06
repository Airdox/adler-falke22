import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Volume2, VolumeX, Radio, Sparkles, BellRing } from 'lucide-react';
import { ConnectionStatus } from '../types';
import {
  playIronClang,
  playIronSwitch,
  playIronTap,
  playIronStop,
  isIronSoundEnabled,
  setIronSoundEnabled,
} from '../utils/ironSound';

interface MassiveIronMicProps {
  status: ConnectionStatus;
  isMuted: boolean;
  audioLevel: number; // 0.0 to 1.0
  recordingSeconds: number;
  onStart: () => void;
  onStop: () => void;
  onToggleMute: () => void;
  onOpenSetup: () => void;
}

export const MassiveIronMic: React.FC<MassiveIronMicProps> = ({
  status,
  isMuted,
  audioLevel,
  recordingSeconds,
  onStart,
  onStop,
  onToggleMute,
  onOpenSetup,
}) => {
  const [soundOn, setSoundOn] = useState(isIronSoundEnabled());
  const [micRecoil, setMicRecoil] = useState(0);
  const [lastTapText, setLastTapText] = useState<string | null>(null);

  const isRecording = status === 'recording';
  const isConnecting = status === 'connecting';
  const isActive = isRecording || isConnecting;

  const handleMicBodyTap = () => {
    // Play authentic resonant cast iron tap sound
    playIronTap();
    setMicRecoil((prev) => prev + 1);
    setLastTapText('EISENKLANG AKTIV');
    setTimeout(() => setLastTapText(null), 1200);
  };

  const handleHeavyIronClang = () => {
    // Deliberate heavy anvil/iron strike
    playIronClang(1.0);
    setMicRecoil((prev) => prev + 1);
    setLastTapText('MASSIVER EISENSCHLAG');
    setTimeout(() => setLastTapText(null), 1500);
  };

  const handleMainToggle = () => {
    if (isActive) {
      playIronStop();
      onStop();
    } else {
      playIronSwitch(true);
      playIronClang(0.85);
      onStart();
    }
  };

  const handleMuteToggle = () => {
    if (!isActive) return;
    playIronSwitch(!isMuted);
    onToggleMute();
  };

  const toggleSoundFx = () => {
    const next = !soundOn;
    setSoundOn(next);
    setIronSoundEnabled(next);
    if (next) {
      playIronTap();
    }
  };

  // VU meter needle rotation: -42deg to +42deg based on audioLevel
  const needleAngle = isRecording && !isMuted ? -42 + audioLevel * 84 : -42;

  // Visual pulse calculation
  const glowIntensity = isRecording && !isMuted ? Math.min(1, 0.3 + audioLevel * 1.5) : 0.08;

  return (
    <div
      id="massive-iron-mic-monument"
      className="relative flex flex-col items-center justify-between h-full bg-gradient-to-b from-[#141618] via-[#0d0f11] to-[#08090a] border-x border-neutral-800/80 p-4 select-none shadow-[inset_0_0_60px_rgba(0,0,0,0.8)]"
    >
      {/* Heavy Steel Top Plaque */}
      <div className="w-full flex items-center justify-between px-2 py-1.5 border-b border-neutral-700/60 bg-neutral-900/60 rounded-t shadow-inner text-[10px] font-mono tracking-widest text-neutral-400">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-neutral-500 shadow-[0_0_5px_rgba(150,150,150,0.5)] inline-block" />
          <span className="font-bold text-neutral-300">EISENMIC • MK-IV</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={toggleSoundFx}
            title={soundOn ? 'Eisensound aktiviert' : 'Eisensound stumm'}
            className={`px-1.5 py-0.5 rounded border transition-colors flex items-center gap-1 ${
              soundOn
                ? 'border-amber-500/50 text-amber-300 bg-amber-950/30'
                : 'border-neutral-700 text-neutral-500 bg-neutral-900'
            }`}
          >
            {soundOn ? <Volume2 className="w-3 h-3" /> : <VolumeX className="w-3 h-3" />}
            <span className="text-[9px]">EISENSOUND</span>
          </button>
        </div>
      </div>

      {/* Floating feedback note for iron strikes */}
      <div className="h-5 flex items-center justify-center my-1">
        {lastTapText ? (
          <motion.span
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="text-[11px] font-mono font-bold tracking-wider text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]"
          >
            {lastTapText}
          </motion.span>
        ) : isRecording ? (
          <span className="text-[11px] font-mono text-emerald-400 tracking-wider flex items-center gap-1.5 animate-pulse">
            <Radio className="w-3 h-3 text-emerald-400" />
            LIVE TRANSCRIBING ({Math.floor(recordingSeconds / 60)}:{(recordingSeconds % 60).toString().padStart(2, '0')})
          </span>
        ) : (
          <span className="text-[11px] font-mono text-neutral-500 tracking-wider">
            MASSIVES GUSSEISEN • BEREIT
          </span>
        )}
      </div>

      {/* THE MASSIVE CAST-IRON MICROPHONE (SVG & Physics Container) */}
      <motion.div
        key={micRecoil}
        animate={{
          y: [0, -3, 2, -1, 0],
          rotate: [0, -0.6, 0.6, -0.2, 0],
        }}
        transition={{ duration: 0.28, ease: 'easeOut' }}
        className="relative flex-1 flex flex-col items-center justify-center w-full max-h-[380px] my-auto cursor-pointer group"
        onClick={handleMicBodyTap}
        title="Klicke auf das Eisenmikrofon für einen echten Eisensound-Resonanztest"
      >
        <svg
          viewBox="0 0 260 360"
          className="w-full h-full max-h-[360px] drop-shadow-[0_15px_30px_rgba(0,0,0,0.9)] overflow-visible"
        >
          <defs>
            {/* Cast Iron Brushed Gradient */}
            <linearGradient id="castIronBody" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#1a1c20" />
              <stop offset="25%" stopColor="#2c3038" />
              <stop offset="50%" stopColor="#414752" />
              <stop offset="70%" stopColor="#2c3038" />
              <stop offset="100%" stopColor="#17191d" />
            </linearGradient>

            {/* Cold Rolled Steel Band */}
            <linearGradient id="steelBand" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#30353d" />
              <stop offset="20%" stopColor="#646d7a" />
              <stop offset="50%" stopColor="#98a3b3" />
              <stop offset="80%" stopColor="#4f5763" />
              <stop offset="100%" stopColor="#252930" />
            </linearGradient>

            {/* Molten Glow for Live Vacuum Tube / Capsule */}
            <radialGradient id="moltenGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#fbbf24" stopOpacity={glowIntensity * 1.5} />
              <stop offset="45%" stopColor="#f97316" stopOpacity={glowIntensity} />
              <stop offset="80%" stopColor="#dc2626" stopOpacity={glowIntensity * 0.5} />
              <stop offset="100%" stopColor="#000000" stopOpacity="0" />
            </radialGradient>

            {/* Heavy Iron Grille Crosshatch */}
            <pattern id="ironMeshPattern" width="6" height="6" patternUnits="userSpaceOnUse">
              <path d="M 0 0 L 6 6 M 6 0 L 0 6" stroke="#121417" strokeWidth="1.2" />
              <circle cx="3" cy="3" r="0.8" fill="#58616e" />
            </pattern>

            {/* Cast Iron Base Pedestal */}
            <linearGradient id="ironPedestal" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#111316" />
              <stop offset="15%" stopColor="#22262c" />
              <stop offset="50%" stopColor="#393f49" />
              <stop offset="85%" stopColor="#1f2329" />
              <stop offset="100%" stopColor="#0d0e10" />
            </linearGradient>
          </defs>

          {/* ================= BACKGROUND STAND & YOKE ================= */}
          {/* Heavy Cast-Iron Shockmount Yoke Arms */}
          <path
            d="M 50 145 C 50 250 210 250 210 145"
            fill="none"
            stroke="url(#castIronBody)"
            strokeWidth="14"
            strokeLinecap="round"
          />
          <path
            d="M 50 145 C 50 250 210 250 210 145"
            fill="none"
            stroke="#5f6978"
            strokeWidth="2"
            strokeLinecap="round"
          />

          {/* Left & Right Heavy Tension Thumbscrews */}
          <g transform="translate(38, 145)">
            <circle cx="0" cy="0" r="10" fill="url(#steelBand)" stroke="#111316" strokeWidth="2" />
            <circle cx="0" cy="0" r="4" fill="#1b1e24" />
            <line x1="-8" y1="0" x2="8" y2="0" stroke="#333" strokeWidth="2" />
            <line x1="0" y1="-8" x2="0" y2="8" stroke="#333" strokeWidth="2" />
          </g>
          <g transform="translate(222, 145)">
            <circle cx="0" cy="0" r="10" fill="url(#steelBand)" stroke="#111316" strokeWidth="2" />
            <circle cx="0" cy="0" r="4" fill="#1b1e24" />
            <line x1="-8" y1="0" x2="8" y2="0" stroke="#333" strokeWidth="2" />
            <line x1="0" y1="-8" x2="0" y2="8" stroke="#333" strokeWidth="2" />
          </g>

          {/* Heavy Steel Suspension Springs */}
          <line x1="50" y1="145" x2="72" y2="135" stroke="#717a87" strokeWidth="3" strokeDasharray="2 3" />
          <line x1="50" y1="175" x2="74" y2="165" stroke="#717a87" strokeWidth="3" strokeDasharray="2 3" />
          <line x1="210" y1="145" x2="188" y2="135" stroke="#717a87" strokeWidth="3" strokeDasharray="2 3" />
          <line x1="210" y1="175" x2="186" y2="165" stroke="#717a87" strokeWidth="3" strokeDasharray="2 3" />

          {/* Vertical Iron Stem from Yoke Base */}
          <rect x="122" y="240" width="16" height="55" fill="url(#steelBand)" stroke="#121417" strokeWidth="2" />
          <line x1="126" y1="240" x2="126" y2="295" stroke="#a0abbd" strokeWidth="1.5" />

          {/* Heavy Cast-Iron Base / Pedestal */}
          {/* Base Tier 1 */}
          <ellipse cx="130" cy="295" rx="55" ry="14" fill="url(#steelBand)" stroke="#0e1012" strokeWidth="2" />
          {/* Base Tier 2: Massive Cast Iron Foot */}
          <ellipse cx="130" cy="308" rx="75" ry="20" fill="url(#ironPedestal)" stroke="#08090a" strokeWidth="3" />
          <ellipse cx="130" cy="305" rx="70" ry="16" fill="none" stroke="#5f6978" strokeWidth="1.5" />
          {/* Industrial Hex Bolts on Base */}
          <circle cx="85" cy="307" r="3.5" fill="#58616f" stroke="#1b1e24" strokeWidth="1" />
          <circle cx="175" cy="307" r="3.5" fill="#58616f" stroke="#1b1e24" strokeWidth="1" />
          <circle cx="130" cy="316" r="3.5" fill="#58616f" stroke="#1b1e24" strokeWidth="1" />

          {/* ================= MICROPHONE CAPSULE BODY ================= */}
          <g transform="translate(0, 0)">
            {/* Interior Molten Core Aura (reactive to voice audioLevel) */}
            <rect
              x="75"
              y="32"
              width="110"
              height="150"
              rx="45"
              fill="url(#moltenGlow)"
              className="transition-all duration-75"
            />

            {/* Outer Heavy Iron Capsule Shell */}
            <rect
              x="76"
              y="30"
              width="108"
              height="150"
              rx="44"
              fill="url(#castIronBody)"
              stroke="#0a0c0e"
              strokeWidth="4"
            />

            {/* Inner Metallic Sound Cavity */}
            <rect
              x="82"
              y="36"
              width="96"
              height="90"
              rx="36"
              fill="#101215"
            />

            {/* Glowing Hot-Cathode / Iron Filaments (Inside Mesh) */}
            {isRecording && !isMuted && (
              <g className="transition-opacity duration-100" style={{ opacity: 0.4 + audioLevel * 0.9 }}>
                {/* Center glowing element */}
                <line x1="130" y1="46" x2="130" y2="116" stroke="#fbbf24" strokeWidth="3" filter="drop-shadow(0 0 8px #f59e0b)" />
                <line x1="120" y1="52" x2="120" y2="110" stroke="#f97316" strokeWidth="2" filter="drop-shadow(0 0 6px #ea580c)" />
                <line x1="140" y1="52" x2="140" y2="110" stroke="#f97316" strokeWidth="2" filter="drop-shadow(0 0 6px #ea580c)" />
              </g>
            )}

            {/* Heavy Cast-Iron Grille Mesh Texture */}
            <rect
              x="82"
              y="36"
              width="96"
              height="90"
              rx="36"
              fill="url(#ironMeshPattern)"
              stroke="#1b1e24"
              strokeWidth="2"
            />

            {/* Heavy Iron Grille Vertical Ribs */}
            <line x1="98" y1="45" x2="98" y2="122" stroke="url(#steelBand)" strokeWidth="3.5" />
            <line x1="114" y1="38" x2="114" y2="124" stroke="url(#steelBand)" strokeWidth="3.5" />
            <line x1="130" y1="36" x2="130" y2="126" stroke="url(#steelBand)" strokeWidth="4.5" />
            <line x1="146" y1="38" x2="146" y2="124" stroke="url(#steelBand)" strokeWidth="3.5" />
            <line x1="162" y1="45" x2="162" y2="122" stroke="url(#steelBand)" strokeWidth="3.5" />

            {/* Middle Steel Reinforcement Ring */}
            <rect
              x="74"
              y="126"
              width="112"
              height="10"
              rx="3"
              fill="url(#steelBand)"
              stroke="#0a0c0e"
              strokeWidth="2"
            />
            {/* Steel Rivets on Ring */}
            <circle cx="84" cy="131" r="2" fill="#2d323a" />
            <circle cx="104" cy="131" r="2" fill="#2d323a" />
            <circle cx="130" cy="131" r="2" fill="#2d323a" />
            <circle cx="156" cy="131" r="2" fill="#2d323a" />
            <circle cx="176" cy="131" r="2" fill="#2d323a" />

            {/* Lower Iron Enclosure Body (Solid Cast Iron) */}
            <path
              d="M 78 136 L 182 136 L 176 186 C 176 195 168 202 158 202 L 102 202 C 92 202 84 195 84 186 Z"
              fill="url(#castIronBody)"
              stroke="#0a0c0e"
              strokeWidth="3"
            />

            {/* Cast Metal Industrial Nameplate Badge */}
            <rect
              x="92"
              y="144"
              width="76"
              height="24"
              rx="3"
              fill="#181b1f"
              stroke="#434a56"
              strokeWidth="1.5"
            />
            <text
              x="130"
              y="155"
              textAnchor="middle"
              fill="#c5cdd9"
              fontSize="7.5"
              fontFamily="monospace"
              fontWeight="bold"
              letterSpacing="1.2"
            >
              MASSIV-EISEN
            </text>
            <text
              x="130"
              y="164"
              textAnchor="middle"
              fill={isRecording ? (isMuted ? '#ef4444' : '#10b981') : '#727d8e'}
              fontSize="6.5"
              fontFamily="monospace"
              fontWeight="bold"
              letterSpacing="0.8"
            >
              {isRecording ? (isMuted ? '● STUMM' : '● LIVE AUFNAHME') : '○ BEREIT'}
            </text>

            {/* Integrated Mechanical Iron Analog VU Meter */}
            <g transform="translate(94, 172)">
              <rect x="0" y="0" width="72" height="22" rx="2" fill="#14171a" stroke="#363b45" strokeWidth="1" />
              {/* VU scale arcs */}
              <path d="M 12 18 Q 36 6 60 18" fill="none" stroke="#48505e" strokeWidth="1.5" />
              {/* Colored zone indicators */}
              <line x1="14" y1="17" x2="16" y2="15" stroke="#10b981" strokeWidth="2" />
              <line x1="36" y1="12" x2="36" y2="9" stroke="#fbbf24" strokeWidth="2" />
              <line x1="56" y1="16" x2="54" y2="14" stroke="#ef4444" strokeWidth="2" />
              {/* VU Needle */}
              <g transform="translate(36, 21)">
                <motion.line
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="-16"
                  stroke={isMuted ? '#ef4444' : isRecording ? '#fbbf24' : '#8590a2'}
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  animate={{ rotate: needleAngle }}
                  transition={{ type: 'spring', stiffness: 300, damping: 15 }}
                />
                <circle cx="0" cy="0" r="2.5" fill="#30353f" stroke="#000" strokeWidth="0.5" />
              </g>
            </g>
          </g>

          {/* Sound Resonance Waves Emitters (when live audio is detected) */}
          {isRecording && !isMuted && audioLevel > 0.05 && (
            <g className="pointer-events-none">
              <circle
                cx="130"
                cy="85"
                r={60 + audioLevel * 40}
                fill="none"
                stroke="#38bdf8"
                strokeWidth="1.5"
                strokeOpacity={Math.max(0, 0.7 - audioLevel * 0.5)}
                strokeDasharray="4 6"
              />
              <circle
                cx="130"
                cy="85"
                r={80 + audioLevel * 60}
                fill="none"
                stroke="#fbbf24"
                strokeWidth="1"
                strokeOpacity={Math.max(0, 0.5 - audioLevel * 0.4)}
                strokeDasharray="2 4"
              />
            </g>
          )}
        </svg>

        {/* Hover Hint Overlay */}
        <div className="absolute inset-x-0 bottom-4 text-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          <span className="text-[10px] font-mono bg-black/80 px-2 py-0.5 rounded border border-neutral-700 text-neutral-300">
            Klick = Eisen-Klangprobe
          </span>
        </div>
      </motion.div>

      {/* ================= HEAVY TACTILE IRON CONTROLS ================= */}
      <div className="w-full flex flex-col gap-2.5 pt-2 border-t border-neutral-800/80">
        {/* Dominant Main Action: HEAVY IRON START/STOP LEVER BUTTON */}
        <button
          id="btn-iron-toggle-session"
          type="button"
          onClick={handleMainToggle}
          className={`w-full py-3 px-4 rounded font-mono font-black text-sm tracking-wider uppercase transition-all duration-150 flex items-center justify-center gap-2.5 shadow-[0_4px_12px_rgba(0,0,0,0.6)] cursor-pointer active:translate-y-0.5 ${
            isRecording
              ? 'bg-gradient-to-b from-red-700 via-red-800 to-red-950 border-2 border-red-500 text-red-100 shadow-[0_0_20px_rgba(220,38,38,0.4)]'
              : 'bg-gradient-to-b from-neutral-700 via-neutral-800 to-neutral-900 border-2 border-neutral-500 text-white hover:from-neutral-600 hover:to-neutral-800 shadow-[0_0_15px_rgba(255,255,255,0.1)]'
          }`}
          title={isRecording ? 'Eisen-Aufnahme stoppen' : 'Eisen-Aufnahme starten'}
        >
          {/* Mechanical indicator light */}
          <span
            className={`w-3 h-3 rounded-full border border-black/60 inline-block shadow-inner ${
              isRecording
                ? 'bg-red-400 animate-pulse shadow-[0_0_8px_#f87171]'
                : isConnecting
                ? 'bg-yellow-400 animate-ping'
                : 'bg-neutral-500'
            }`}
          />
          <span>{isRecording ? 'STOPPEN & ANALYSIEREN' : isConnecting ? 'VERBINDE EISENMIC...' : 'AUFNAHME STARTEN'}</span>
        </button>

        {/* Secondary Industrial Iron Controls Bar */}
        <div className="grid grid-cols-3 gap-2">
          {/* MUTE HEBEL */}
          <button
            id="btn-iron-mute"
            type="button"
            onClick={handleMuteToggle}
            disabled={!isActive}
            className={`py-2 px-1 rounded border font-mono text-[11px] font-bold tracking-tight transition-colors flex items-center justify-center gap-1 ${
              !isActive
                ? 'border-neutral-800 text-neutral-600 bg-neutral-950 cursor-not-allowed'
                : isMuted
                ? 'border-red-500 bg-red-950/80 text-red-300 shadow-[0_0_10px_rgba(239,68,68,0.3)] cursor-pointer'
                : 'border-neutral-700 bg-neutral-900 text-neutral-300 hover:bg-neutral-800 cursor-pointer'
            }`}
            title="Mikrofon-Stummschaltung"
          >
            <span>{isMuted ? 'STUMM' : 'AKTIV'}</span>
          </button>

          {/* EISENSCHLAG / ANVIL CLANG TEST TRIGGER */}
          <button
            id="btn-iron-strike"
            type="button"
            onClick={handleHeavyIronClang}
            className="py-2 px-1 rounded border border-amber-500/40 bg-gradient-to-b from-neutral-800 to-neutral-900 text-amber-300 hover:border-amber-400 hover:text-amber-200 font-mono text-[11px] font-bold tracking-tight transition-colors flex items-center justify-center gap-1 cursor-pointer"
            title="Echten massiven Eisenklang anschlagen"
          >
            <BellRing className="w-3.5 h-3.5 text-amber-400" />
            <span>EISENSCHLAG</span>
          </button>

          {/* EINSTELLUNGEN / VOCABULARY */}
          <button
            id="btn-iron-setup"
            type="button"
            onClick={onOpenSetup}
            className="py-2 px-1 rounded border border-neutral-700 bg-neutral-900 text-neutral-300 hover:bg-neutral-800 font-mono text-[11px] font-bold tracking-tight transition-colors flex items-center justify-center gap-1 cursor-pointer"
            title="Einstellungen & Vokabular"
          >
            <Sparkles className="w-3.5 h-3.5 text-neutral-400" />
            <span>SETUP</span>
          </button>
        </div>
      </div>
    </div>
  );
};
