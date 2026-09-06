/**
 * @license
 * HighEndRenderAnimationModal Component
 * 
 * Breathtaking 3D Isometric Reverse Exploded Assembly Studio:
 * - Isometrische / Axonometrische Halb-3D-Perspektive von schräg oben (Draufsicht + zwei sichtbare Seitenflächen mit Extrusionstiefe).
 * - Echte interaktive 3D-Kamera: Drehbar und neigbar per Maus-Drag (Orbit), Zoombar per Mausrad.
 * - Umgekehrte Explosionszeichnung (Reverse Exploded Assembly / Implosion):
 *   Die Einzelelemente (Deck A Basis Signal 1, schwebender Clip Signal 2 an Position X, DSP-Effektmodule und Beatgrid-Matrix)
 *   fliegen aus dem Raum mit Leucht-Schweif und Montage-Leitstrahlen punktgenau an ihre Soll-Position ein und rasten mit einem satten Shockwave-Snap ein!
 * - Kontinuierlicher 60-FPS Canvas Loop mit Ref-Synchronisation (kein Stottern oder Einfrieren).
 * - Fusions-Reaktion: Signal 1 ⊕ Signal 2 verschmelzen zu neuem Signal 3 (32-Bit IEEE Float Master).
 * - Interaktiver Explosionsgrad-Schieberegler (0% montiert ↔ 100% explodiert), Presets, Slow-Motion und Audio-Impulse.
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Layers,
  Sparkles,
  Sliders,
  Volume2,
  VolumeX,
  Play,
  Pause,
  RotateCcw,
  CheckCircle,
  Activity,
  Waves,
  Box,
  Compass,
  Download,
  X
} from 'lucide-react';
import { TrackModel, PaletteClip } from '../../types/rekordbox';

export interface RenderJobConfig {
  title: string;
  operationType: 'OVERDUB' | 'REPLACE' | 'INSERT' | 'EXPORT_WAV' | 'EXPORT_XML' | 'FX_APPLY';
  positionSec: number;
  durationSec: number;
  clipName?: string;
  clipBpm?: number;
  clipKey?: string;
  targetBpm?: number;
  targetKey?: string;
  fxName?: string;
  outputFormat?: 'WAV' | 'XML' | 'JSON' | 'PROJECT';
}

interface HighEndRenderAnimationModalProps {
  isOpen: boolean;
  onClose: () => void;
  track: TrackModel;
  workingAudioBuffer?: AudioBuffer | null;
  activeClip?: PaletteClip | null;
  jobConfig?: RenderJobConfig;
  onApplyRender?: () => void;
  onDownloadWav?: () => void;
}

type CameraPreset = 'ISOMETRIC' | 'EXPLODED_TOP' | 'FRONT_EXTRUSION' | 'TOP_DOWN';

interface Point3D {
  x: number;
  y: number;
  z: number;
}

interface ProjectedPoint {
  x: number;
  y: number;
  depth: number;
}

function projectPoint(
  p: Point3D,
  rotX: number,
  rotY: number,
  cx: number,
  cy: number,
  scale: number
): ProjectedPoint {
  // Rotate around Y (Azimuth)
  const cosY = Math.cos(rotY);
  const sinY = Math.sin(rotY);
  const x1 = p.x * cosY + p.z * sinY;
  const z1 = -p.x * sinY + p.z * cosY;

  // Rotate around X (Elevation / Pitch)
  const cosX = Math.cos(rotX);
  const sinX = Math.sin(rotX);
  const y2 = p.y * cosX - z1 * sinX;
  const z2 = p.y * sinX + z1 * cosX;

  // Axonometric / Isometric with subtle depth perspective
  const fov = 1200;
  const pScale = scale * (fov / Math.max(200, fov + z2 * 0.35));

  return {
    x: cx + x1 * pScale,
    y: cy + y2 * pScale,
    depth: z2,
  };
}

export const HighEndRenderAnimationModal: React.FC<HighEndRenderAnimationModalProps> = ({
  isOpen,
  onClose,
  track,
  workingAudioBuffer,
  activeClip,
  jobConfig,
  onApplyRender,
  onDownloadWav,
}) => {
  // CRITICAL: Immediately return null when not open to prevent phantom overlay
  if (!isOpen) return null;

  // Core Render & Playback state
  const [progress, setProgress] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0); // 1.0, 0.5, 0.25
  const [soundEnabled, setSoundEnabled] = useState<boolean>(false);
  const [isDone, setIsDone] = useState<boolean>(false);

  // 3D Interactive Camera state:
  const [cameraRotX, setCameraRotX] = useState<number>(0.58);
  const [cameraRotY, setCameraRotY] = useState<number>(-0.62);
  const [cameraZoom, setCameraZoom] = useState<number>(1.05);
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('ISOMETRIC');

  // Interactive Explosion Control:
  const [autoAssemble, setAutoAssemble] = useState<boolean>(true);
  const [manualExplosion, setManualExplosion] = useState<number>(0.85);

  // Mouse drag interaction
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number; rotX: number; rotY: number }>({
    x: 0,
    y: 0,
    rotX: 0.58,
    rotY: -0.62,
  });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Configuration derived from active operation or default fallback
  const config: RenderJobConfig = useMemo(() => {
    if (jobConfig) return jobConfig;
    const pos = track.duration ? track.duration * 0.35 : 44.2;
    const dur = 7.38;
    return {
      title: 'Signal 1 ⊕ Signal 2 Zusammensetzung (Overdub/Render)',
      operationType: 'OVERDUB',
      positionSec: pos,
      durationSec: dur,
      clipName: activeClip?.name || 'Vocals & Synth Stabs 8B',
      clipBpm: activeClip?.bpm || track.bpm,
      clipKey: activeClip?.key || track.key,
      targetBpm: track.bpm,
      targetKey: track.key,
      fxName: 'Resonanz Filter Sweep & 1/2 Beat Echo',
      outputFormat: 'WAV',
    };
  }, [jobConfig, track, activeClip]);

  const totalDuration = Math.max(1, track.duration || 300);
  const positionX = Math.max(0, config.positionSec);
  const clipDuration = Math.max(0.5, config.durationSec);

  // Total samples to render
  const sampleRate = track.sampleRate || 44100;
  const totalSamples = Math.round(totalDuration * sampleRate);
  const currentSamplesProcessed = Math.round((progress / 100) * totalSamples);

  // Calculate current effective explosion factor:
  const effectiveExplosion = useMemo(() => {
    if (!autoAssemble) return manualExplosion;
    const norm = Math.max(0, 1 - progress / 75);
    return Math.pow(norm, 1.4);
  }, [autoAssemble, manualExplosion, progress]);

  // Preset camera angle switch
  const applyPreset = (preset: CameraPreset) => {
    setCameraPreset(preset);
    if (preset === 'ISOMETRIC') {
      setCameraRotX(0.58);
      setCameraRotY(-0.62);
      setCameraZoom(1.05);
    } else if (preset === 'EXPLODED_TOP') {
      setCameraRotX(0.85);
      setCameraRotY(-0.45);
      setCameraZoom(1.15);
    } else if (preset === 'FRONT_EXTRUSION') {
      setCameraRotX(0.22);
      setCameraRotY(-0.25);
      setCameraZoom(1.0);
    } else if (preset === 'TOP_DOWN') {
      setCameraRotX(1.48);
      setCameraRotY(0.0);
      setCameraZoom(0.95);
    }
  };

  // Synthesize soft futuristic sound pulses if enabled
  const playSynthChirp = (freq: number, dur = 0.08) => {
    if (!soundEnabled) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.5, ctx.currentTime + dur);
      gain.gain.setValueAtTime(0.04, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + dur);
    } catch {
      // Audio context restricted or unavailable
    }
  };

  // Rendering step progression
  const renderPhases = [
    { threshold: 0, label: '3D Raum-Splitting & Komponenten-Explosion', subtext: 'Einzelelemente schweben im isometrischen Koordinatenraum.' },
    { threshold: 22, label: 'Signal 2 Trajektorie an Position X', subtext: `Clip "${config.clipName}" gleitet mit Laser-Führung zur Deck A Spur.` },
    { threshold: 45, label: 'DSP-Effektzüge & Filter-Einschub', subtext: `${config.fxName || 'Resonanzfilter & 1/2 Beat Echo'} rasten mechanisch ein.` },
    { threshold: 70, label: 'Signal 1 ⊕ Signal 2 Superpositions-Fusion', subtext: 'Wellenform-Verschmelzung f3(t) = f1(t) + f2(t-X) zu Signal 3.' },
    { threshold: 92, label: 'Endmontage & 32-Bit Floating Master Lock', subtext: 'Alle Schichten verriegelt. Beatgrid-Marker phasenrein verankert.' },
    { threshold: 100, label: 'Rendering & Montage erfolgreich abgeschlossen!', subtext: 'Neuer zusammengesetzter 32-Bit Float Master ist einsatzbereit.' },
  ];

  const currentPhase = useMemo(() => {
    let p = renderPhases[0];
    for (const phase of renderPhases) {
      if (progress >= phase.threshold) p = phase;
    }
    return p;
  }, [progress]);

  // Main animation timer loop
  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval>;
    if (isPlaying && !isDone) {
      intervalId = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 100) {
            setIsDone(true);
            setIsPlaying(false);
            playSynthChirp(880, 0.25);
            return 100;
          }
          const increment = 0.55 * playbackSpeed;
          const next = Math.min(100, prev + increment);

          if (Math.floor(next / 20) > Math.floor(prev / 20)) {
            playSynthChirp(440 + (next / 100) * 440, 0.05);
          }
          return next;
        });
      }, 30);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isPlaying, playbackSpeed, isDone, soundEnabled]);

  // Canvas Mouse Orbit Handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      rotX: cameraRotX,
      rotY: cameraRotY,
    };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;

    const newRotX = Math.min(1.5, Math.max(0.08, dragStartRef.current.rotX + dy * 0.006));
    const newRotY = dragStartRef.current.rotY + dx * 0.007;

    setCameraRotX(newRotX);
    setCameraRotY(newRotY);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const zoomDelta = e.deltaY > 0 ? -0.06 : 0.06;
    setCameraZoom((prev) => Math.min(2.0, Math.max(0.65, prev + zoomDelta)));
  };

  // Keep a live reference to animation state so the 60fps render loop never needs to be torn down!
  const animStateRef = useRef({
    cameraRotX,
    cameraRotY,
    cameraZoom,
    effectiveExplosion,
    progress,
    playbackSpeed,
    positionX,
    clipDuration,
    totalDuration,
    trackTitle: track.title,
    clipName: config.clipName || 'Vocals & Synth',
    fxName: config.fxName || 'Resonanz Filter & Echo',
  });

  useEffect(() => {
    animStateRef.current = {
      cameraRotX,
      cameraRotY,
      cameraZoom,
      effectiveExplosion,
      progress,
      playbackSpeed,
      positionX,
      clipDuration,
      totalDuration,
      trackTitle: track.title,
      clipName: config.clipName || 'Vocals & Synth',
      fxName: config.fxName || 'Resonanz Filter & Echo',
    };
  }, [
    cameraRotX,
    cameraRotY,
    cameraZoom,
    effectiveExplosion,
    progress,
    playbackSpeed,
    positionX,
    clipDuration,
    totalDuration,
    track.title,
    config.clipName,
    config.fxName,
  ]);

  // Persistent 60-FPS 3D Canvas visualizer loop
  useEffect(() => {
    let animId: number;
    let t = 0;

    const renderCanvas = () => {
      const state = animStateRef.current;
      t += 0.03 * state.playbackSpeed;

      const canvas = canvasRef.current;
      if (!canvas) {
        animId = requestAnimationFrame(renderCanvas);
        return;
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        animId = requestAnimationFrame(renderCanvas);
        return;
      }

      const w = canvas.width || 1024;
      const h = canvas.height || 520;
      const cx = w * 0.5;
      const cy = h * 0.52;
      const baseScale = Math.min(w / 1100, h / 650) * state.cameraZoom;

      // Dark space background
      ctx.fillStyle = '#07090e';
      ctx.fillRect(0, 0, w, h);

      const rotX = state.cameraRotX;
      const rotY = state.cameraRotY;
      const expl = state.effectiveExplosion;
      const curProg = state.progress;

      // ─────────────────────────────────────────────────────────────
      // 1. 3D ISOMETRIC GRID FLOOR
      // ─────────────────────────────────────────────────────────────
      ctx.lineWidth = 1;
      const gridCount = 9;
      const gridSpacing = 80;
      const gridHalf = (gridCount * gridSpacing) / 2;
      const gridY = 160;

      // Radial gradient glow on the floor center
      const floorCenter = projectPoint({ x: 0, y: gridY, z: 0 }, rotX, rotY, cx, cy, baseScale);
      if (!isNaN(floorCenter.x) && !isNaN(floorCenter.y)) {
        try {
          const radius = Math.max(10, 360 * baseScale);
          const floorGrad = ctx.createRadialGradient(floorCenter.x, floorCenter.y, 10, floorCenter.x, floorCenter.y, radius);
          floorGrad.addColorStop(0, 'rgba(0, 136, 255, 0.12)');
          floorGrad.addColorStop(0.5, 'rgba(0, 229, 255, 0.04)');
          floorGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
          ctx.fillStyle = floorGrad;
          ctx.fillRect(0, 0, w, h);
        } catch {
          // Ignore gradient bounds
        }
      }

      // Grid lines
      ctx.strokeStyle = 'rgba(28, 40, 62, 0.45)';
      for (let i = -gridHalf; i <= gridHalf; i += gridSpacing) {
        const pA = projectPoint({ x: i, y: gridY, z: -gridHalf }, rotX, rotY, cx, cy, baseScale);
        const pB = projectPoint({ x: i, y: gridY, z: gridHalf }, rotX, rotY, cx, cy, baseScale);
        ctx.beginPath();
        ctx.moveTo(pA.x, pA.y);
        ctx.lineTo(pB.x, pB.y);
        ctx.stroke();

        const pC = projectPoint({ x: -gridHalf, y: gridY, z: i }, rotX, rotY, cx, cy, baseScale);
        const pD = projectPoint({ x: gridHalf, y: gridY, z: i }, rotX, rotY, cx, cy, baseScale);
        ctx.beginPath();
        ctx.moveTo(pC.x, pC.y);
        ctx.lineTo(pD.x, pD.y);
        ctx.stroke();
      }

      // ─────────────────────────────────────────────────────────────
      // 2. HELPER TO DRAW AN EXTRUDED 3D ISOMETRIC SLAB (QUADER)
      // ─────────────────────────────────────────────────────────────
      const draw3DBox = (
        bx: number,
        by: number,
        bz: number,
        bw: number,
        bh: number,
        bd: number,
        topColor: string,
        frontColor: string,
        sideColor: string,
        strokeColor: string,
        alpha = 1.0
      ) => {
        const v = [
          projectPoint({ x: bx - bw / 2, y: by, z: bz - bd / 2 }, rotX, rotY, cx, cy, baseScale), // 0: Top-Back-Left
          projectPoint({ x: bx + bw / 2, y: by, z: bz - bd / 2 }, rotX, rotY, cx, cy, baseScale), // 1: Top-Back-Right
          projectPoint({ x: bx + bw / 2, y: by, z: bz + bd / 2 }, rotX, rotY, cx, cy, baseScale), // 2: Top-Front-Right
          projectPoint({ x: bx - bw / 2, y: by, z: bz + bd / 2 }, rotX, rotY, cx, cy, baseScale), // 3: Top-Front-Left

          projectPoint({ x: bx - bw / 2, y: by + bh, z: bz - bd / 2 }, rotX, rotY, cx, cy, baseScale), // 4: Bot-Back-Left
          projectPoint({ x: bx + bw / 2, y: by + bh, z: bz - bd / 2 }, rotX, rotY, cx, cy, baseScale), // 5: Bot-Back-Right
          projectPoint({ x: bx + bw / 2, y: by + bh, z: bz + bd / 2 }, rotX, rotY, cx, cy, baseScale), // 6: Bot-Front-Right
          projectPoint({ x: bx - bw / 2, y: by + bh, z: bz + bd / 2 }, rotX, rotY, cx, cy, baseScale), // 7: Bot-Front-Left
        ];

        ctx.save();
        ctx.globalAlpha = alpha;

        // FRONT FACE
        if (frontColor !== 'transparent') {
          ctx.fillStyle = frontColor;
          ctx.strokeStyle = strokeColor;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(v[3].x, v[3].y);
          ctx.lineTo(v[2].x, v[2].y);
          ctx.lineTo(v[6].x, v[6].y);
          ctx.lineTo(v[7].x, v[7].y);
          ctx.closePath();
          ctx.fill();
          if (strokeColor !== 'transparent') ctx.stroke();
        }

        // SIDE RIGHT FACE
        if (sideColor !== 'transparent') {
          ctx.fillStyle = sideColor;
          ctx.strokeStyle = strokeColor;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(v[2].x, v[2].y);
          ctx.lineTo(v[1].x, v[1].y);
          ctx.lineTo(v[5].x, v[5].y);
          ctx.lineTo(v[6].x, v[6].y);
          ctx.closePath();
          ctx.fill();
          if (strokeColor !== 'transparent') ctx.stroke();
        }

        // TOP FACE
        if (topColor !== 'transparent') {
          ctx.fillStyle = topColor;
          ctx.strokeStyle = strokeColor;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(v[0].x, v[0].y);
          ctx.lineTo(v[1].x, v[1].y);
          ctx.lineTo(v[2].x, v[2].y);
          ctx.lineTo(v[3].x, v[3].y);
          ctx.closePath();
          ctx.fill();
          if (strokeColor !== 'transparent') ctx.stroke();
        }

        ctx.restore();
        return v;
      };

      // ─────────────────────────────────────────────────────────────
      // 3. REVERSE EXPLODED ASSEMBLY OFFSETS & COORDINATES
      // ─────────────────────────────────────────────────────────────
      const trackWidth = 580;
      const trackDepth = 48;
      const slabHeight = 12;

      const normPosX = Math.min(0.85, Math.max(0.1, state.positionX / state.totalDuration));
      const normDur = Math.min(0.4, Math.max(0.08, state.clipDuration / state.totalDuration));
      const clipCenterLocalX = (normPosX + normDur * 0.5 - 0.5) * trackWidth;
      const clipWidth = normDur * trackWidth;

      // SCHICHT 1: DECK A BASIS TRACK (SIGNAL 1)
      const l1Pos: Point3D = {
        x: 0,
        y: 40 + expl * 110,
        z: expl * 30,
      };

      // Base Slab (Deck A)
      draw3DBox(
        l1Pos.x,
        l1Pos.y,
        l1Pos.z,
        trackWidth,
        slabHeight,
        trackDepth,
        'rgba(14, 25, 45, 0.94)',
        'rgba(8, 16, 30, 0.98)',
        'rgba(5, 12, 22, 0.98)',
        '#0088ff'
      );

      // Draw Extruded 3D Waveform Peaks for Signal 1 on the Top Face
      ctx.save();
      const waveSamples = 55;
      for (let i = 0; i < waveSamples; i++) {
        const stepX = -trackWidth / 2 + (i / waveSamples) * trackWidth;
        const norm = i / waveSamples;
        const amp = Math.sin(norm * 18 + t * 0.5) * Math.cos(norm * 7) * 14 + 16;

        const baseP = projectPoint({ x: stepX, y: l1Pos.y, z: l1Pos.z }, rotX, rotY, cx, cy, baseScale);
        const topP = projectPoint({ x: stepX, y: l1Pos.y - amp, z: l1Pos.z }, rotX, rotY, cx, cy, baseScale);

        ctx.strokeStyle = i % 2 === 0 ? '#00e5ff' : '#0088ff';
        ctx.lineWidth = 2 * baseScale;
        ctx.beginPath();
        ctx.moveTo(baseP.x, baseP.y);
        ctx.lineTo(topP.x, topP.y);
        ctx.stroke();
      }
      ctx.restore();

      // Label on Schicht 1
      const l1LabelP = projectPoint({ x: -trackWidth / 2, y: l1Pos.y - 14, z: l1Pos.z - trackDepth / 2 }, rotX, rotY, cx, cy, baseScale);
      ctx.fillStyle = '#0088ff';
      ctx.font = `bold ${Math.round(11 * baseScale)}px monospace`;
      ctx.fillText(`SCHICHT 1: DECK A BASIS-SPUR (SIGNAL 1) — ${state.trackTitle}`, l1LabelP.x, l1LabelP.y);

      // Target landing zone outline on Deck A
      ctx.save();
      ctx.strokeStyle = '#00e5ff88';
      ctx.lineWidth = 1.5;
      const targetP1 = projectPoint({ x: clipCenterLocalX - clipWidth / 2, y: l1Pos.y - 0.5, z: l1Pos.z - trackDepth / 2 }, rotX, rotY, cx, cy, baseScale);
      const targetP2 = projectPoint({ x: clipCenterLocalX + clipWidth / 2, y: l1Pos.y - 0.5, z: l1Pos.z - trackDepth / 2 }, rotX, rotY, cx, cy, baseScale);
      const targetP3 = projectPoint({ x: clipCenterLocalX + clipWidth / 2, y: l1Pos.y - 0.5, z: l1Pos.z + trackDepth / 2 }, rotX, rotY, cx, cy, baseScale);
      const targetP4 = projectPoint({ x: clipCenterLocalX - clipWidth / 2, y: l1Pos.y - 0.5, z: l1Pos.z + trackDepth / 2 }, rotX, rotY, cx, cy, baseScale);
      ctx.beginPath();
      ctx.moveTo(targetP1.x, targetP1.y);
      ctx.lineTo(targetP2.x, targetP2.y);
      ctx.lineTo(targetP3.x, targetP3.y);
      ctx.lineTo(targetP4.x, targetP4.y);
      ctx.closePath();
      ctx.stroke();
      ctx.restore();

      // ─────────────────────────────────────────────────────────────
      // SCHICHT 2: AUDIO-CLIP AN POSITION X (SIGNAL 2) — THE FLYING COMPONENT
      // ─────────────────────────────────────────────────────────────
      const l2Pos: Point3D = {
        x: clipCenterLocalX,
        y: l1Pos.y - slabHeight - 6 - expl * 210,
        z: l1Pos.z - expl * 110,
      };

      // CAD Assembly Guide Rails (Laser-Lotlinien) connecting the floating clip to its target zone
      ctx.save();
      ctx.setLineDash([4 * baseScale, 4 * baseScale]);
      ctx.strokeStyle = `rgba(255, 149, 0, ${0.35 + (1 - expl) * 0.45})`;
      ctx.lineWidth = 1.5;

      const corners = [
        { x: -clipWidth / 2, z: -trackDepth / 2 },
        { x: clipWidth / 2, z: -trackDepth / 2 },
        { x: clipWidth / 2, z: trackDepth / 2 },
        { x: -clipWidth / 2, z: trackDepth / 2 },
      ];

      corners.forEach((c) => {
        const topCorner = projectPoint({ x: l2Pos.x + c.x, y: l2Pos.y + slabHeight, z: l2Pos.z + c.z }, rotX, rotY, cx, cy, baseScale);
        const botCorner = projectPoint({ x: clipCenterLocalX + c.x, y: l1Pos.y, z: l1Pos.z + c.z }, rotX, rotY, cx, cy, baseScale);
        ctx.beginPath();
        ctx.moveTo(topCorner.x, topCorner.y);
        ctx.lineTo(botCorner.x, botCorner.y);
        ctx.stroke();
      });
      ctx.setLineDash([]);
      ctx.restore();

      // Draw Schicht 2: Extruded Golden/Amber Clip Block
      draw3DBox(
        l2Pos.x,
        l2Pos.y,
        l2Pos.z,
        clipWidth,
        slabHeight * 1.2,
        trackDepth * 1.05,
        'rgba(50, 30, 8, 0.95)',
        'rgba(35, 18, 5, 0.98)',
        'rgba(25, 12, 3, 0.98)',
        '#ff9500'
      );

      // Animated 3D Waveform for Signal 2 (Vocal / Clip)
      ctx.save();
      const clipWaveSamples = 22;
      for (let i = 0; i < clipWaveSamples; i++) {
        const stepX = l2Pos.x - clipWidth / 2 + (i / clipWaveSamples) * clipWidth;
        const norm = i / clipWaveSamples;
        const amp = Math.sin(norm * 14 + t * 4) * 16 + 10;

        const baseP = projectPoint({ x: stepX, y: l2Pos.y, z: l2Pos.z }, rotX, rotY, cx, cy, baseScale);
        const topP = projectPoint({ x: stepX, y: l2Pos.y - amp, z: l2Pos.z }, rotX, rotY, cx, cy, baseScale);

        ctx.strokeStyle = '#ffaa00';
        ctx.lineWidth = 2.5 * baseScale;
        ctx.beginPath();
        ctx.moveTo(baseP.x, baseP.y);
        ctx.lineTo(topP.x, topP.y);
        ctx.stroke();
      }
      ctx.restore();

      // Label on Schicht 2
      const l2LabelP = projectPoint({ x: l2Pos.x - clipWidth / 2, y: l2Pos.y - 16, z: l2Pos.z - trackDepth / 2 }, rotX, rotY, cx, cy, baseScale);
      ctx.fillStyle = '#ff9500';
      ctx.font = `bold ${Math.round(11 * baseScale)}px monospace`;
      ctx.fillText(`SCHICHT 2: AUDIO-CLIP (SIGNAL 2) [t = ${state.positionX.toFixed(1)}s]`, l2LabelP.x, l2LabelP.y);

      if (expl > 0.05) {
        ctx.fillStyle = 'rgba(255, 170, 0, 0.85)';
        ctx.font = `${Math.round(9.5 * baseScale)}px monospace`;
        ctx.fillText(`EXPLOSION DIST: ${(expl * 100).toFixed(0)}% | OFFSET: ${state.positionX.toFixed(2)}s`, l2LabelP.x, l2LabelP.y + 14);
      }

      // ─────────────────────────────────────────────────────────────
      // SCHICHT 3: AUDIOEFFEKTZÜGE & DSP-RACKS
      // ─────────────────────────────────────────────────────────────
      const fxLeftPos: Point3D = {
        x: -trackWidth / 2 - 80 - expl * 180,
        y: l1Pos.y - 50 - expl * 50,
        z: l1Pos.z + 40,
      };

      const fxRightPos: Point3D = {
        x: trackWidth / 2 + 80 + expl * 180,
        y: l1Pos.y - 50 - expl * 50,
        z: l1Pos.z + 40,
      };

      // Left FX Rack: Resonanz-Filter Sweep
      draw3DBox(
        fxLeftPos.x,
        fxLeftPos.y,
        fxLeftPos.z,
        110,
        28,
        50,
        'rgba(35, 15, 30, 0.92)',
        'rgba(25, 8, 20, 0.98)',
        'rgba(20, 5, 15, 0.98)',
        '#ec4899'
      );

      // Right FX Rack: Beat Echo & Quantize Delay
      draw3DBox(
        fxRightPos.x,
        fxRightPos.y,
        fxRightPos.z,
        110,
        28,
        50,
        'rgba(20, 15, 45, 0.92)',
        'rgba(14, 8, 35, 0.98)',
        'rgba(10, 5, 25, 0.98)',
        '#8b5cf6'
      );

      // Cable & laser connections from FX modules into Position X
      if (curProg >= 35) {
        ctx.save();
        ctx.strokeStyle = 'rgba(236, 72, 153, 0.65)';
        ctx.lineWidth = 1.5;
        const fxLeftPort = projectPoint({ x: fxLeftPos.x + 55, y: fxLeftPos.y + 14, z: fxLeftPos.z }, rotX, rotY, cx, cy, baseScale);
        const targetPort = projectPoint({ x: clipCenterLocalX, y: l2Pos.y + slabHeight, z: l2Pos.z }, rotX, rotY, cx, cy, baseScale);
        ctx.beginPath();
        ctx.moveTo(fxLeftPort.x, fxLeftPort.y);
        ctx.lineTo(targetPort.x, targetPort.y);
        ctx.stroke();

        ctx.strokeStyle = 'rgba(139, 92, 246, 0.65)';
        const fxRightPort = projectPoint({ x: fxRightPos.x - 55, y: fxRightPos.y + 14, z: fxRightPos.z }, rotX, rotY, cx, cy, baseScale);
        ctx.beginPath();
        ctx.moveTo(fxRightPort.x, fxRightPort.y);
        ctx.lineTo(targetPort.x, targetPort.y);
        ctx.stroke();
        ctx.restore();
      }

      // FX labels
      const fxLeftLabelP = projectPoint({ x: fxLeftPos.x - 50, y: fxLeftPos.y - 12, z: fxLeftPos.z }, rotX, rotY, cx, cy, baseScale);
      ctx.fillStyle = '#ec4899';
      ctx.font = `bold ${Math.round(9.5 * baseScale)}px monospace`;
      ctx.fillText('DSP-FX 1: RESONANZ FILTER', fxLeftLabelP.x, fxLeftLabelP.y);

      const fxRightLabelP = projectPoint({ x: fxRightPos.x - 50, y: fxRightPos.y - 12, z: fxRightPos.z }, rotX, rotY, cx, cy, baseScale);
      ctx.fillStyle = '#8b5cf6';
      ctx.font = `bold ${Math.round(9.5 * baseScale)}px monospace`;
      ctx.fillText('DSP-FX 2: BEAT ECHO ROLL', fxRightLabelP.x, fxRightLabelP.y);

      // ─────────────────────────────────────────────────────────────
      // SCHICHT 4: FUSION-REAKTOR & COMPOSITE SIGNAL 3 (ERGEBNIS)
      // ─────────────────────────────────────────────────────────────
      const l4Pos: Point3D = {
        x: 0,
        y: l1Pos.y + slabHeight + 16 + (1 - expl) * 25,
        z: l1Pos.z,
      };

      if (curProg >= 38) {
        const fusionAlpha = Math.min(1.0, (curProg - 38) / 25);

        // Resulting composite slab (Signal 3)
        draw3DBox(
          l4Pos.x,
          l4Pos.y,
          l4Pos.z,
          trackWidth,
          slabHeight * 1.1,
          trackDepth,
          'rgba(5, 38, 22, 0.95)',
          'rgba(3, 25, 14, 0.98)',
          'rgba(2, 18, 10, 0.98)',
          '#00ff9d',
          fusionAlpha
        );

        // Render resulting Fused Waveform (Signal 3 = Signal 1 ⊕ Signal 2)
        ctx.save();
        ctx.globalAlpha = fusionAlpha;
        for (let i = 0; i < waveSamples; i++) {
          const stepX = -trackWidth / 2 + (i / waveSamples) * trackWidth;
          const norm = i / waveSamples;
          const isInTargetZone = Math.abs(stepX - clipCenterLocalX) <= clipWidth / 2;

          let amp = Math.sin(norm * 18 + t * 0.5) * Math.cos(norm * 7) * 14 + 16;
          if (isInTargetZone) {
            amp += Math.sin(norm * 45 + t * 4) * 12 + 10;
          }

          const baseP = projectPoint({ x: stepX, y: l4Pos.y, z: l4Pos.z }, rotX, rotY, cx, cy, baseScale);
          const topP = projectPoint({ x: stepX, y: l4Pos.y - amp, z: l4Pos.z }, rotX, rotY, cx, cy, baseScale);

          ctx.strokeStyle = isInTargetZone ? '#00ff9d' : '#10b981';
          ctx.lineWidth = (isInTargetZone ? 3.0 : 2.0) * baseScale;
          ctx.beginPath();
          ctx.moveTo(baseP.x, baseP.y);
          ctx.lineTo(topP.x, topP.y);
          ctx.stroke();
        }
        ctx.restore();

        // Label on Schicht 4
        const l4LabelP = projectPoint({ x: -trackWidth / 2, y: l4Pos.y + slabHeight + 20, z: l4Pos.z - trackDepth / 2 }, rotX, rotY, cx, cy, baseScale);
        ctx.fillStyle = '#00ff9d';
        ctx.font = `bold ${Math.round(11 * baseScale)}px monospace`;
        ctx.fillText('SCHICHT 4: FUSIONS-MASTER (SIGNAL 1 ⊕ SIGNAL 2 = NEUES SIGNAL 3)', l4LabelP.x, l4LabelP.y);
      }

      // ─────────────────────────────────────────────────────────────
      // 4. DYNAMIC 3D SHOCKWAVE EXPANSION WHEN FULLY ASSEMBLED
      // ─────────────────────────────────────────────────────────────
      if (curProg >= 65 && expl < 0.25) {
        ctx.save();
        const shockRadius = ((t * 70) % 220) * baseScale;
        const shockAlpha = Math.max(0, 1 - shockRadius / (220 * baseScale));

        ctx.strokeStyle = `rgba(0, 255, 157, ${shockAlpha * 0.85})`;
        ctx.lineWidth = 2.5;

        ctx.beginPath();
        const shockSegments = 28;
        for (let s = 0; s <= shockSegments; s++) {
          const rad = (s / shockSegments) * Math.PI * 2;
          const sx = clipCenterLocalX + Math.cos(rad) * shockRadius;
          const sz = l1Pos.z + Math.sin(rad) * (shockRadius * 0.4);
          const sp = projectPoint({ x: sx, y: l1Pos.y, z: sz }, rotX, rotY, cx, cy, baseScale);
          if (s === 0) ctx.moveTo(sp.x, sp.y);
          else ctx.lineTo(sp.x, sp.y);
        }
        ctx.stroke();
        ctx.restore();
      }

      animId = requestAnimationFrame(renderCanvas);
    };

    animId = requestAnimationFrame(renderCanvas);
    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
  }, []); // Runs continuously while open

  return (
    <div
      className="fixed inset-0 bg-black/92 backdrop-blur-xl flex items-center justify-center z-[100] select-none p-2 sm:p-4 pointer-events-auto"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="w-full max-w-5xl h-[90vh] bg-[#0b0d13] border border-[#22283a] rounded-sm shadow-2xl flex flex-col overflow-hidden text-neutral-200">
        
        {/* Top Header: Title, Badges, Camera Presets, Sound FX, Close */}
        <div className="h-13 bg-[#121520] border-b border-[#1f2436] px-4 flex items-center justify-between flex-shrink-0 gap-2">
          {/* Left Title */}
          <div className="flex items-center space-x-2.5 min-w-0">
            <div className="p-1.5 rounded-xs bg-[#00ff9d]/15 border border-[#00ff9d]/40 text-[#00ff9d] flex-shrink-0">
              <Waves size={16} />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-white flex items-center space-x-2 flex-wrap">
                <span className="truncate">3D Isometrische Explosions-Bühne</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-xs bg-[#00e5ff]/20 text-[#00e5ff] font-mono border border-[#00e5ff]/40">
                  REVERSE EXPLODED VIEW
                </span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-xs bg-[#f59e0b]/20 text-[#fbbf24] font-mono border border-[#f59e0b]/40">
                  SIGNAL 1 ⊕ 2 = 3
                </span>
              </div>
              <div className="text-[10px] text-neutral-400 truncate">
                Axonometrische Halb-3D-Perspektive mit Extrusion &amp; Schichten-Zusammenbau
              </div>
            </div>
          </div>

          {/* Camera Presets & Close */}
          <div className="flex items-center space-x-2 flex-shrink-0">
            <div className="flex items-center space-x-1 bg-[#181d2c] p-0.5 rounded border border-[#273046]">
              <button
                type="button"
                onClick={() => applyPreset('ISOMETRIC')}
                className={`px-2 py-1 rounded-xs text-[10px] font-medium transition-colors flex items-center space-x-1 cursor-pointer ${
                  cameraPreset === 'ISOMETRIC' ? 'bg-[#0088ff] text-white shadow-sm font-bold' : 'text-neutral-400 hover:text-white'
                }`}
                title="Isometrisch 3D (Schräg von oben mit 2 Seitenflächen)"
              >
                <Box size={11} />
                <span>Isometrisch 3D</span>
              </button>
              <button
                type="button"
                onClick={() => applyPreset('EXPLODED_TOP')}
                className={`px-2 py-1 rounded-xs text-[10px] font-medium transition-colors flex items-center space-x-1 cursor-pointer ${
                  cameraPreset === 'EXPLODED_TOP' ? 'bg-[#0088ff] text-white shadow-sm font-bold' : 'text-neutral-400 hover:text-white'
                }`}
                title="Explodierte Schichten im 3D-Tiefenraum"
              >
                <Layers size={11} />
                <span>Explosions-3D</span>
              </button>
              <button
                type="button"
                onClick={() => applyPreset('FRONT_EXTRUSION')}
                className={`px-2 py-1 rounded-xs text-[10px] font-medium transition-colors flex items-center space-x-1 cursor-pointer ${
                  cameraPreset === 'FRONT_EXTRUSION' ? 'bg-[#0088ff] text-white shadow-sm font-bold' : 'text-neutral-400 hover:text-white'
                }`}
                title="Front-Extrusions-Ansicht"
              >
                <Compass size={11} />
                <span>Front-Profil</span>
              </button>
              <button
                type="button"
                onClick={() => applyPreset('TOP_DOWN')}
                className={`px-2 py-1 rounded-xs text-[10px] font-medium transition-colors flex items-center space-x-1 cursor-pointer ${
                  cameraPreset === 'TOP_DOWN' ? 'bg-[#0088ff] text-white shadow-sm font-bold' : 'text-neutral-400 hover:text-white'
                }`}
                title="Draufsicht (Top-Down Orthografisch)"
              >
                <Sliders size={11} />
                <span>Draufsicht</span>
              </button>
            </div>

            {/* Sound FX toggle */}
            <button
              type="button"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`p-1.5 rounded-xs border transition-colors cursor-pointer ${
                soundEnabled ? 'bg-[#00e5ff]/20 text-[#00e5ff] border-[#00e5ff]/40' : 'bg-[#181c28] text-neutral-400 border-[#262e42] hover:text-white'
              }`}
              title={soundEnabled ? 'Sound FX stummschalten' : 'Sci-Fi Sound FX aktivieren'}
            >
              {soundEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xs bg-[#181c28] hover:bg-[#252c40] text-neutral-400 hover:text-white transition-colors cursor-pointer"
              title="Schließen"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Telemetry & Assembly Stage Banner */}
        <div className="h-9 bg-[#0e111a] border-b border-[#1b2030] px-4 flex items-center justify-between text-xs gap-2">
          <div className="flex items-center space-x-2 truncate">
            <Activity size={13} className="text-[#00ff9d] animate-pulse flex-shrink-0" />
            <span className="text-white font-bold">{currentPhase.label}:</span>
            <span className="text-neutral-400 text-[11px] truncate">{currentPhase.subtext}</span>
          </div>

          {/* Interactive Explosion Slider & Telemetry stats */}
          <div className="flex items-center space-x-3 text-[10.5px] font-mono text-neutral-400 flex-shrink-0">
            <div className="flex items-center space-x-2 bg-[#141824] px-2.5 py-1 rounded border border-[#232b3f]">
              <span className="text-neutral-300">Explosion:</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={effectiveExplosion}
                onChange={(e) => {
                  setAutoAssemble(false);
                  setManualExplosion(parseFloat(e.target.value));
                }}
                className="w-20 accent-[#0088ff] cursor-pointer"
                title="Explosionsgrad: 0% montiert ↔ 100% explodiert"
              />
              <span className="text-[#00e5ff] font-bold w-9 text-right">
                {Math.round(effectiveExplosion * 100)}%
              </span>
              <button
                type="button"
                onClick={() => setAutoAssemble(!autoAssemble)}
                className={`text-[9px] px-1.5 py-0.5 rounded transition-colors cursor-pointer ${
                  autoAssemble ? 'bg-[#0088ff] text-white font-bold' : 'bg-[#232b3f] text-neutral-400 hover:text-white'
                }`}
                title="Auto-Zusammenbau: Teile fliegen synchron zum Render-Fortschritt ein"
              >
                Auto-Snap
              </button>
            </div>

            <span>Offset X: <strong className="text-[#ff9500]">{positionX.toFixed(2)}s</strong></span>
            <span>Dauer: <strong className="text-[#00e5ff]">{clipDuration.toFixed(2)}s</strong></span>
          </div>
        </div>

        {/* Main High-End 3D Visual Stage (Canvas) */}
        <div className="flex-1 relative overflow-hidden bg-[#07090e] cursor-grab active:cursor-grabbing">
          <canvas
            ref={canvasRef}
            width={1024}
            height={520}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
            className="w-full h-full object-cover select-none"
          />

          {/* Orbit Navigation Hint */}
          <div className="absolute top-3 right-3 bg-[#0f131da0] backdrop-blur-md border border-[#242d42] px-2.5 py-1.5 rounded text-[10px] font-mono text-neutral-400 flex items-center space-x-2 pointer-events-none">
            <Compass size={12} className="text-[#00e5ff]" />
            <span>Maus ziehen: 3D Drehen &amp; Kippen | Rad: Zoom</span>
          </div>

          {/* Floating Stage Legend HUD */}
          <div className="absolute top-3 left-3 bg-[#0f131da0] backdrop-blur-md border border-[#242d42] p-2.5 rounded text-[10px] space-y-1 font-mono pointer-events-none">
            <div className="text-neutral-400 flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-[#0088ff]"></span>
              <span>Schicht 1: Deck A Basis-Schiene (Signal 1)</span>
            </div>
            <div className="text-neutral-400 flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-[#ff9500]"></span>
              <span>Schicht 2: Schwebender Clip an Position X (Signal 2)</span>
            </div>
            <div className="text-neutral-400 flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-[#ec4899]"></span>
              <span>Schicht 3: Audioeffektzüge (DSP Color &amp; Beat FX)</span>
            </div>
            <div className="text-neutral-400 flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-[#00ff9d]"></span>
              <span>Schicht 4: Zusammengesetzter Master (Signal 3)</span>
            </div>
          </div>

          {/* Completion Badge */}
          {isDone && (
            <div className="absolute bottom-4 right-4 bg-[#0a2016]/90 border border-[#155a3b] p-3 rounded shadow-2xl flex items-center space-x-3 text-xs animate-in fade-in zoom-in duration-200 pointer-events-none">
              <CheckCircle size={22} className="text-[#00ff9d]" />
              <div>
                <div className="font-bold text-white">Montage &amp; Rendering erfolgreich!</div>
                <div className="text-[10px] text-neutral-400">Signal 3 ist phasenrein fusioniert und einsatzbereit.</div>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Control Dock: Playback, Speed, Progress Bar, Actions */}
        <div className="h-16 bg-[#11141e] border-t border-[#1d2334] px-4 flex items-center justify-between flex-shrink-0 gap-3">
          {/* Play / Pause / Replay & Speed Controls */}
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => setIsPlaying(!isPlaying)}
              className="w-8 h-8 rounded bg-[#0088ff] hover:bg-[#0070d6] text-white flex items-center justify-center transition-colors shadow-sm cursor-pointer"
              title={isPlaying ? 'Pause' : 'Wiedergabe starten'}
            >
              {isPlaying ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
            </button>
            <button
              type="button"
              onClick={() => {
                setProgress(0);
                setIsDone(false);
                setIsPlaying(true);
                setAutoAssemble(true);
              }}
              className="p-2 rounded bg-[#191f2e] hover:bg-[#232b3f] text-neutral-300 hover:text-white transition-colors cursor-pointer"
              title="Animation von vorn starten (Explodieren &amp; Montieren)"
            >
              <RotateCcw size={14} />
            </button>

            {/* Speed selector */}
            <div className="flex items-center space-x-1 ml-2 text-[10px] font-mono bg-[#161b27] px-2 py-1 rounded border border-[#232b3f]">
              <span className="text-neutral-500 mr-1">Tempo:</span>
              {[1.0, 0.5, 0.25].map((spd) => (
                <button
                  type="button"
                  key={spd}
                  onClick={() => setPlaybackSpeed(spd)}
                  className={`px-1.5 py-0.5 rounded-xs transition-colors cursor-pointer ${
                    playbackSpeed === spd ? 'bg-[#0088ff] text-white font-bold' : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  {spd}x
                </button>
              ))}
            </div>
          </div>

          {/* Central Progress Bar */}
          <div className="flex-1 max-w-md mx-4 flex flex-col justify-center space-y-1">
            <div className="flex justify-between text-[10px] font-mono text-neutral-400">
              <span>Rendering &amp; Zusammenbau Fortschritt</span>
              <span className="text-[#00ff9d] font-bold">{Math.round(progress)}%</span>
            </div>
            <div className="w-full h-2 bg-[#1b2130] rounded-full overflow-hidden border border-[#273046]">
              <div
                className="h-full bg-gradient-to-r from-[#0088ff] via-[#ff9500] to-[#00ff9d] transition-all duration-75"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Action Buttons: Apply in Deck / Download WAV / Close */}
          <div className="flex items-center space-x-2">
            {onDownloadWav && (
              <button
                type="button"
                onClick={onDownloadWav}
                disabled={!isDone}
                className="px-3 py-1.5 rounded-xs bg-[#1a2333] hover:bg-[#253248] text-[#00a2ff] border border-[#293d5c] text-xs font-bold transition-colors flex items-center space-x-1.5 disabled:opacity-40 cursor-pointer"
                title="Gemischten Master als WAV herunterladen"
              >
                <Download size={13} />
                <span>WAV Exportieren</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                if (onApplyRender) onApplyRender();
                onClose();
              }}
              className="px-4 py-1.5 rounded-xs bg-[#00ff9d] hover:bg-[#00e58d] text-black text-xs font-bold transition-colors flex items-center space-x-1.5 shadow-lg shadow-[#00ff9d]/20 cursor-pointer"
              title="Änderung in Deck übernehmen &amp; schließen"
            >
              <CheckCircle size={14} />
              <span>{isDone ? 'In Deck übernehmen' : 'Rendering fertigstellen'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
