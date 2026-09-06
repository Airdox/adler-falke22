import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { SetupPanel } from './components/SetupPanel';
import { MassiveIronMic } from './components/MassiveIronMic';
import { AnalysisModal } from './components/AnalysisModal';
import { Play, Square, SlidersHorizontal, Pause, Wand2, Mic, Anvil, Sparkles, Volume2 } from 'lucide-react';
import {
  ConnectionStatus,
  SetupConfig,
  TranscriptSegment,
  GeminiResponsePayload,
  AnalysisResult,
} from './types';
import {
  floatTo16BitPCM,
  arrayBufferToBase64,
  calculateAudioLevel,
} from './utils/audio';
import {
  playIronClang,
  playIronSwitch,
  playIronStop,
  playIronTap,
} from './utils/ironSound';

const SENTENCE_COLORS = [
  '#f87171', // Red
  '#fb923c', // Orange
  '#fbbf24', // Amber
  '#a3e635', // Lime
  '#4ade80', // Green
  '#34d399', // Emerald
  '#2dd4bf', // Teal
  '#38bdf8', // Light Blue
  '#60a5fa', // Blue
  '#818cf8', // Indigo
  '#a78bfa', // Violet
  '#c084fc', // Purple
  '#e879f9', // Fuchsia
  '#f472b6', // Pink
  '#fb7185', // Rose
];

const COMMON_FILLER_WORDS = new Set([
  'um', 'uh', 'er', 'ah', 'like', 'literally', 'basically', 'actually', 
  'seriously', 'totally', 'obviously', 'essentially', 'right', 'okay', 'so', 
  'well', 'yeah', 'yep', 'nope', 'huh', 'hmm'
]);

function isFillerWord(rawWord: string): boolean {
  const clean = rawWord.toLowerCase().replace(/[^a-z0-9']/g, '').trim();
  return COMMON_FILLER_WORDS.has(clean);
}

function isSentenceEndingWord(rawWord: string): boolean {
  return /[.!?]$/.test(rawWord.trim());
}

const AnimatedWord = React.memo(({ word, color, isFiller }: { word: string; color: string; isFiller?: boolean }) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: isFiller ? 0.75 : 1, scale: 1 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
      className={`inline-block relative px-2.5 py-0.5 mx-1 my-1.5 text-white font-medium rounded-md shadow-sm ${
        isFiller ? 'italic border-b-2 border-dotted border-white/60 ring-1 ring-amber-400/50' : ''
      }`}
      style={{ backgroundColor: color }}
    >
      <span className="whitespace-nowrap">{word}</span>
    </motion.div>
  );
});
AnimatedWord.displayName = 'AnimatedWord';

export default function App() {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [isMuted, setIsMuted] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'mic' | 'verbatim' | 'smart'>('all');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [paceMode, setPaceMode] = useState<'gross' | 'net'>('gross');

  const [config, setConfig] = useState<SetupConfig>({
    model: 'models/gemini-3.5-transcribe-live',
    customVocabulary: ['like', 'um', 'uh', 'you know'],
    languageCodes: [],
  });

  const [isSetupOpen, setIsSetupOpen] = useState(false);

  // Left Column State (Smart Mode)
  const [smartSegments, setSmartSegments] = useState<TranscriptSegment[]>([]);
  const [smartInterimText, setSmartInterimText] = useState('');

  // Right Column State (Verbatim Mode)
  const [verbatimSegments, setVerbatimSegments] = useState<TranscriptSegment[]>([]);
  const [verbatimInterimText, setVerbatimInterimText] = useState('');
  
  // Audio & Connection Refs
  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const timerRef = useRef<number | null>(null);
  const leftTranscriptEndRef = useRef<HTMLDivElement>(null);
  const rightTranscriptEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);

  const isMutedRef = useRef(isMuted);
  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  const recordingSecondsRef = useRef(recordingSeconds);
  useEffect(() => {
    recordingSecondsRef.current = recordingSeconds;
  }, [recordingSeconds]);

  const smartSegmentsRef = useRef(smartSegments);
  useEffect(() => {
    smartSegmentsRef.current = smartSegments;
  }, [smartSegments]);

  const verbatimSegmentsRef = useRef(verbatimSegments);
  useEffect(() => {
    verbatimSegmentsRef.current = verbatimSegments;
  }, [verbatimSegments]);

  // Auto-scroll transcripts
  useEffect(() => {
    if (leftTranscriptEndRef.current) {
      leftTranscriptEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [verbatimSegments, verbatimInterimText]);

  useEffect(() => {
    if (rightTranscriptEndRef.current) {
      rightTranscriptEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [smartSegments, smartInterimText]);

  const stopAudio = useCallback(async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.disconnect();
      scriptProcessorRef.current = null;
    }

    let audioBase64: string | undefined;
    let audioMimeType: string | undefined;

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      const getAudioBase64 = new Promise<{ base64: string; mimeType: string }>((resolve) => {
        mediaRecorderRef.current!.onstop = () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: mediaRecorderRef.current!.mimeType });
          const reader = new FileReader();
          reader.readAsDataURL(audioBlob);
          reader.onloadend = () => {
            const result = reader.result as string;
            const base64 = result.split(',')[1];
            resolve({ base64, mimeType: audioBlob.type });
          };
        };
      });
      mediaRecorderRef.current.stop();
      
      try {
        const audioData = await getAudioBase64;
        audioBase64 = audioData.base64;
        audioMimeType = audioData.mimeType;
      } catch (err) {
        console.error('Failed to encode audio', err);
      }
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setAudioLevel(0);
    setStatus('disconnected');
    playIronStop();

    // Trigger analysis if speech was recorded
    const allVerbatim = verbatimSegmentsRef.current.map((s) => s.text).join(' ');
    const allSmart = smartSegmentsRef.current.map((s) => s.text).join(' ');
    const combinedTranscript = (allSmart.length > allVerbatim.length ? allSmart : allVerbatim).trim();
    if (combinedTranscript.length > 5 && recordingSecondsRef.current >= 1) {
      setIsAnalyzing(true);
      fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: combinedTranscript,
          durationSeconds: recordingSecondsRef.current,
          audioBase64,
          audioMimeType,
        }),
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && !data.error) {
            setAnalysisResult(data);
          }
        })
        .catch((e) => console.warn('Analysis fetch error:', e))
        .finally(() => setIsAnalyzing(false));
    }
  }, []);

  const handleServerMessage = useCallback((event: MessageEvent) => {
    try {
      const payload: GeminiResponsePayload = JSON.parse(event.data);
      if (payload.type === 'connected') {
        setStatus('recording');
        setErrorMessage(null);
      } else if (payload.type === 'error') {
        setErrorMessage(payload.error || 'Gemini API Error');
        setStatus('error');
      } else if (payload.type === 'gemini_response' && payload.serverContent) {
        const serverContent = payload.serverContent;
        const interim =
          serverContent.interimInputTranscription?.text ||
          serverContent.interim_input_transcription?.text;
        const finalContent =
          serverContent.inputTranscription?.text ||
          serverContent.input_transcription?.text;

        const targetMode = payload.mode || 'smart';

        if (targetMode === 'smart') {
          if (interim !== undefined) {
            setSmartInterimText(interim);
          }
          if (finalContent && finalContent.trim().length > 0) {
            const newSegment: TranscriptSegment = {
              id: `smart_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              text: finalContent.trim(),
              timestamp: new Date().toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              }),
              isFinal: true,
            };
            setSmartSegments((prev) => [...prev, newSegment]);
            setSmartInterimText('');
          }
        } else {
          // Verbatim mode
          if (interim !== undefined) {
            setVerbatimInterimText(interim);
          }
          if (finalContent && finalContent.trim().length > 0) {
            const newSegment: TranscriptSegment = {
              id: `verbatim_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              text: finalContent.trim(),
              timestamp: new Date().toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              }),
              isFinal: true,
            };
            setVerbatimSegments((prev) => [...prev, newSegment]);
            setVerbatimInterimText('');
          }
        }
      }
    } catch (err) {
      console.error('Failed to parse WebSocket message:', err);
    }
  }, []);

  const handleToggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      playIronSwitch(!next);
      return next;
    });
  }, []);

  const startRecording = async () => {
    playIronSwitch(true);
    playIronClang(0.85);
    setErrorMessage(null);
    setSmartSegments([]);
    setSmartInterimText('');
    setVerbatimSegments([]);
    setVerbatimInterimText('');
    setRecordingSeconds(0);
    audioChunksRef.current = [];

    setStatus('connecting');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      mediaStreamRef.current = stream;

      // Audio recorder for full speech evaluation
      try {
        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : MediaRecorder.isTypeSupported('audio/mp4')
          ? 'audio/mp4'
          : 'audio/webm';
        const mediaRecorder = new MediaRecorder(stream, { mimeType });
        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };
        mediaRecorder.start(1000);
        mediaRecorderRef.current = mediaRecorder;
      } catch (recErr) {
        console.warn('MediaRecorder not available or failed:', recErr);
      }

      // Audio Context for real-time PCM extraction
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioCtx = new AudioCtx({ sampleRate: 16000 });
      audioContextRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;

      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      scriptProcessorRef.current = processor;

      source.connect(analyser);
      analyser.connect(processor);
      processor.connect(audioCtx.destination);

      // WebSocket Connection to Backend Proxy
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws/transcribe`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        // Send initial configuration
        ws.send(
          JSON.stringify({
            type: 'configure',
            model: config.model,
            languageCodes: config.languageCodes,
            customVocabulary: config.customVocabulary,
          })
        );
      };

      ws.onmessage = handleServerMessage;

      ws.onerror = (err) => {
        console.error('WebSocket error:', err);
        setErrorMessage('WebSocket connection error. Verify Gemini API key.');
        setStatus('error');
      };

      ws.onclose = () => {
        if (status === 'recording' || status === 'connecting') {
          setStatus('disconnected');
        }
      };

      // Stream PCM chunks to WebSocket
      processor.onaudioprocess = (e) => {
        if (isMutedRef.current) {
          setAudioLevel(0);
          return;
        }

        const inputData = e.inputBuffer.getChannelData(0);
        const level = calculateAudioLevel(inputData);
        setAudioLevel(level);

        if (ws.readyState === WebSocket.OPEN) {
          const pcm16 = floatTo16BitPCM(inputData);
          const base64 = arrayBufferToBase64(pcm16);
          ws.send(
            JSON.stringify({
              type: 'audio',
              audio: base64,
              mimeType: 'audio/pcm;rate=16000',
            })
          );
        }
      };

      // Recording elapsed timer
      timerRef.current = window.setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: unknown) {
      console.error('Error starting audio recording:', err);
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('Permission') || message.includes('denied')) {
        setErrorMessage('Microphone access denied. Please allow microphone permissions in your browser.');
      } else {
        setErrorMessage(`Microphone error: ${message}`);
      }
      setStatus('error');
    }
  };

  // Compute animated word items for Smart Column
  const smartWordList = useMemo(() => {
    let wordCounter = 0;
    let currentSentenceIdx = 0;
    const coloredWords: { id: string; word: string; color: string; isFiller: boolean }[] = [];

    smartSegments.forEach((segment) => {
      const words = segment.text.split(/\s+/).filter((w) => w.length > 0);
      words.forEach((w) => {
        const color = SENTENCE_COLORS[currentSentenceIdx % SENTENCE_COLORS.length];
        coloredWords.push({
          id: `smart-${wordCounter++}-${w}`,
          word: w,
          color,
          isFiller: false,
        });
        if (isSentenceEndingWord(w)) {
          currentSentenceIdx++;
        }
      });
    });

    if (smartInterimText && smartInterimText.trim().length > 0) {
      const words = smartInterimText.trim().split(/\s+/).filter((w) => w.length > 0);
      words.forEach((w) => {
        const color = SENTENCE_COLORS[currentSentenceIdx % SENTENCE_COLORS.length];
        coloredWords.push({
          id: `smart-${wordCounter++}-${w}`,
          word: w,
          color,
          isFiller: false,
        });
        if (isSentenceEndingWord(w)) {
          currentSentenceIdx++;
        }
      });
    }

    return coloredWords;
  }, [smartSegments, smartInterimText]);

  // Compute animated word items for Verbatim Column
  const verbatimWordList = useMemo(() => {
    let wordCounter = 0;
    let currentSentenceIdx = 0;
    const coloredWords: { id: string; word: string; color: string; isFiller: boolean }[] = [];

    verbatimSegments.forEach((segment) => {
      const words = segment.text.split(/\s+/).filter((w) => w.length > 0);
      words.forEach((w) => {
        const color = SENTENCE_COLORS[currentSentenceIdx % SENTENCE_COLORS.length];
        const isFiller = isFillerWord(w);
        coloredWords.push({
          id: `verbatim-${wordCounter++}-${w}`,
          word: w,
          color,
          isFiller,
        });
        if (isSentenceEndingWord(w)) {
          currentSentenceIdx++;
        }
      });
    });

    if (verbatimInterimText && verbatimInterimText.trim().length > 0) {
      const words = verbatimInterimText.trim().split(/\s+/).filter((w) => w.length > 0);
      words.forEach((w) => {
        const color = SENTENCE_COLORS[currentSentenceIdx % SENTENCE_COLORS.length];
        const isFiller = isFillerWord(w);
        coloredWords.push({
          id: `verbatim-${wordCounter++}-${w}`,
          word: w,
          color,
          isFiller,
        });
        if (isSentenceEndingWord(w)) {
          currentSentenceIdx++;
        }
      });
    }

    return coloredWords;
  }, [verbatimSegments, verbatimInterimText]);

  const isActive = status === 'recording' || status === 'connecting';

  const totalWords = verbatimWordList.length;
  const fillerCount = verbatimWordList.filter((w) => w.isFiller).length;
  const netWords = Math.max(0, totalWords - fillerCount);
  const speechDurationSeconds = Math.max(1, recordingSeconds);
  const grossPaceWpm = Math.round((totalWords / speechDurationSeconds) * 60);
  const netPaceWpm = Math.round((netWords / speechDurationSeconds) * 60);
  const currentPaceWpm = paceMode === 'gross' ? grossPaceWpm : netPaceWpm;
  const pacePercentage = Math.min(100, Math.round((currentPaceWpm / 150) * 100));
  const fillerPercentage = totalWords > 0 ? Math.round((fillerCount / totalWords) * 100) : 0;

  return (
    <div className="relative flex h-screen w-full flex-col overflow-hidden bg-black text-white">
      {/* Top Header Navigation */}
      <header className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-4 sm:px-6 py-3 border-b border-neutral-800/80 bg-black/80 backdrop-blur-md">
        {/* Left: Model & Branding */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-neutral-900 border border-neutral-700 text-neutral-200">
            <img 
              src="https://www.gstatic.com/lamda/images/gemini_sparkle_aurora_33f86dc0c0257da337c63.svg" 
              alt="Gemini Sparkle" 
              className="w-3.5 h-3.5 inline-block" 
            />
            <span className="font-mono text-[11px] font-bold tracking-wider lowercase">
              gemini-3.5-transcribe-live
            </span>
          </div>
          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded border border-amber-500/30 bg-amber-950/20 text-amber-300 font-mono text-[10px] tracking-wider font-semibold">
            <span>MASSIVES EISENMIKROFON</span>
          </div>
        </div>

        {/* Center: Responsive View Switcher (for small/medium screens) */}
        <div className="flex lg:hidden items-center bg-neutral-900 border border-neutral-800 rounded-lg p-0.5 text-xs font-mono">
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`px-2.5 py-1 rounded ${activeTab === 'all' ? 'bg-neutral-700 text-white font-bold' : 'text-neutral-400'}`}
          >
            Alle
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('mic')}
            className={`px-2.5 py-1 rounded ${activeTab === 'mic' ? 'bg-neutral-700 text-white font-bold' : 'text-neutral-400'}`}
          >
            Eisenmic
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('verbatim')}
            className={`px-2.5 py-1 rounded ${activeTab === 'verbatim' ? 'bg-neutral-700 text-white font-bold' : 'text-neutral-400'}`}
          >
            Verbatim
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('smart')}
            className={`px-2.5 py-1 rounded ${activeTab === 'smart' ? 'bg-neutral-700 text-white font-bold' : 'text-neutral-400'}`}
          >
            Smart
          </button>
        </div>

        {/* Right: Live Status Indicator & Quick Eisenschlag Button */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => playIronClang(1.0)}
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded border border-neutral-700 hover:border-amber-500/60 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-amber-300 font-mono text-[11px] font-medium transition-colors cursor-pointer"
            title="Echten massiven Eisenklang anschlagen"
          >
            <span className="text-amber-400">⚡</span>
            <span>Eisenschlag</span>
          </button>

          {status === 'recording' && (
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-red-950/90 border border-red-500/60 text-red-300 text-xs font-mono animate-pulse">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              <span>LIVE ({Math.floor(recordingSeconds / 60)}:{(recordingSeconds % 60).toString().padStart(2, '0')})</span>
              <div className="w-10 h-2 bg-neutral-800 rounded-full overflow-hidden ml-1">
                <div 
                  className="h-full bg-emerald-400 transition-all duration-75"
                  style={{ width: `${Math.min(100, audioLevel * 100)}%` }}
                />
              </div>
            </div>
          )}
          {status === 'connecting' && (
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-yellow-950/80 border border-yellow-500/50 text-yellow-300 text-xs font-mono">
              <span className="w-2 h-2 rounded-full bg-yellow-400 animate-ping" />
              <span>VERBINDE EISENMIC...</span>
            </div>
          )}
        </div>
      </header>

      {/* Main Content Area: Tri-Panel Layout with Massive Iron Microphone as the Dominant Centerpiece */}
      <main className="flex-1 w-full grid grid-cols-1 lg:grid-cols-[1fr_360px_1fr] overflow-hidden pt-14 pb-4">
        
        {/* LEFT COLUMN: Verbatim Mode */}
        <section
          aria-label="Verbatim Transkription"
          className={`flex-col h-full overflow-hidden border-b lg:border-b-0 lg:border-r border-neutral-800/80 px-4 sm:px-6 md:px-8 ${
            activeTab === 'all' || activeTab === 'verbatim' ? 'flex' : 'hidden lg:flex'
          }`}
        >
          {/* Column Header */}
          <div className="shrink-0 flex items-center justify-between py-3 border-b border-neutral-800/80 mb-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              <h2 className="font-sans text-xs font-bold uppercase tracking-wider text-neutral-200">
                Verbatim-Kanal
              </h2>
            </div>
            {verbatimWordList.length > 0 && (
              <span className="font-mono text-[11px] text-neutral-400">{verbatimWordList.length} Wörter</span>
            )}
          </div>

          {/* Transcript Scroll Container */}
          <div className="flex-1 overflow-y-auto pr-2 flex flex-col">
            <div className="grow flex flex-col justify-center">
              <div className="flex flex-wrap items-center justify-center font-sans tracking-tight text-center text-xl sm:text-2xl md:text-3xl transition-all duration-300">
                <AnimatePresence mode="popLayout">
                  {verbatimWordList.length === 0 ? (
                    <motion.div
                      key="verbatim-welcome"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex flex-col items-center justify-center gap-3 text-center max-w-sm mx-auto py-8"
                    >
                      <div className="w-12 h-12 rounded-2xl bg-neutral-900 border border-neutral-700 flex items-center justify-center text-red-400">
                        <Mic className="w-6 h-6" />
                      </div>
                      <h3 className="font-sans text-xl font-bold text-white">Wortgetreuer Rohstrom</h3>
                      <p className="font-sans text-sm text-neutral-400 leading-relaxed">
                        Erfasst jedes einzelne Wort und jede Sprechpause direkt aus dem massiven Eisenmikrofon. Hebt Füllwörter farblich hervor.
                      </p>
                    </motion.div>
                  ) : (
                    verbatimWordList.map((item) => (
                      <AnimatedWord key={item.id} word={item.word} color={item.color} isFiller={item.isFiller} />
                    ))
                  )}
                </AnimatePresence>
              </div>
            </div>
            <div ref={leftTranscriptEndRef} className="h-12 w-full shrink-0" />
          </div>
        </section>

        {/* CENTER COLUMN: MASSIVES EISENMIKROFON (DOMINANTES GLIED) */}
        <section
          aria-label="Massives Eisenmikrofon"
          className={`h-full overflow-hidden flex flex-col items-center justify-center ${
            activeTab === 'all' || activeTab === 'mic' ? 'flex' : 'hidden lg:flex'
          }`}
        >
          <MassiveIronMic
            status={status}
            isMuted={isMuted}
            audioLevel={audioLevel}
            recordingSeconds={recordingSeconds}
            onStart={startRecording}
            onStop={stopAudio}
            onToggleMute={handleToggleMute}
            onOpenSetup={() => setIsSetupOpen(true)}
          />
        </section>

        {/* RIGHT COLUMN: Smart Mode */}
        <section
          aria-label="Smarte Transkription"
          className={`flex-col h-full overflow-hidden border-t lg:border-t-0 lg:border-l border-neutral-800/80 px-4 sm:px-6 md:px-8 ${
            activeTab === 'all' || activeTab === 'smart' ? 'flex' : 'hidden lg:flex'
          }`}
        >
          {/* Column Header */}
          <div className="shrink-0 flex items-center justify-between py-3 border-b border-neutral-800/80 mb-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <h2 className="font-sans text-xs font-bold uppercase tracking-wider text-neutral-200">
                Smarte Transkription
              </h2>
            </div>
            {smartWordList.length > 0 && (
              <span className="font-mono text-[11px] text-neutral-400">{smartWordList.length} Wörter</span>
            )}
          </div>

          {/* Transcript Scroll Container */}
          <div className="flex-1 overflow-y-auto pr-2 flex flex-col">
            <div className="grow flex flex-col justify-center">
              <div className="flex flex-wrap items-center justify-center font-sans tracking-tight text-center text-xl sm:text-2xl md:text-3xl transition-all duration-300">
                <AnimatePresence mode="popLayout">
                  {smartWordList.length === 0 ? (
                    <motion.div
                      key="smart-welcome"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex flex-col items-center justify-center gap-3 text-center max-w-sm mx-auto py-8"
                    >
                      <div className="w-12 h-12 rounded-2xl bg-neutral-900 border border-neutral-700 flex items-center justify-center text-emerald-400">
                        <Wand2 className="w-6 h-6" />
                      </div>
                      <h3 className="font-sans text-xl font-bold text-white">Intelligente Veredelung</h3>
                      <p className="font-sans text-sm text-neutral-400 leading-relaxed">
                        Bereinigt Füllwörter wie &bdquo;ähm&ldquo; und &bdquo;uh&ldquo;, formatiert den Text vollautomatisch und liefert druckreifen Fließtext.
                      </p>
                    </motion.div>
                  ) : (
                    smartWordList.map((item) => (
                      <AnimatedWord key={item.id} word={item.word} color={item.color} isFiller={false} />
                    ))
                  )}
                </AnimatePresence>
              </div>
            </div>
            <div ref={rightTranscriptEndRef} className="h-12 w-full shrink-0" />
          </div>
        </section>

      </main>

      {/* Error Toast */}
      <AnimatePresence>
        {errorMessage && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="absolute top-16 z-50 self-center border border-red-500 bg-red-950/95 px-6 py-4 font-mono text-sm text-red-200 shadow-2xl max-w-lg text-center rounded"
          >
            <div className="font-bold mb-2">FEHLER: {errorMessage}</div>
            {errorMessage.includes('Permission') && (
              <div className="mt-4 flex flex-col gap-3">
                <p className="text-xs text-red-300">
                  Browser blockieren oft den Mikrofon-Zugriff im Vorschaumodus. Öffne die App in einem separaten Tab, um die Berechtigung zu erteilen.
                </p>
                <button
                  onClick={() => window.open(window.location.href, '_blank')}
                  className="px-4 py-2 bg-red-600 text-white font-bold hover:bg-red-500 transition-colors rounded cursor-pointer"
                >
                  App im neuen Tab öffnen
                </button>
              </div>
            )}
            <button
              onClick={() => setErrorMessage(null)}
              className="absolute top-2 right-2 text-red-400 hover:text-white cursor-pointer"
            >
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Configuration Modal */}
      <SetupPanel
        isOpen={isSetupOpen}
        onClose={() => setIsSetupOpen(false)}
        config={config}
        onSaveConfig={setConfig}
      />

      {/* Analysis Modal for Speech Breakdown */}
      <AnalysisModal
        isAnalyzing={isAnalyzing}
        analysisResult={analysisResult}
        onClose={() => setAnalysisResult(null)}
        paceMode={paceMode}
        setPaceMode={setPaceMode}
        totalWords={totalWords}
        fillerCount={fillerCount}
        netWords={netWords}
        speechDurationSeconds={speechDurationSeconds}
        grossPaceWpm={grossPaceWpm}
        netPaceWpm={netPaceWpm}
        currentPaceWpm={currentPaceWpm}
        pacePercentage={pacePercentage}
        fillerPercentage={fillerPercentage}
      />
    </div>
  );
}
