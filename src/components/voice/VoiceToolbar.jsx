import { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, MicOff, Volume2, VolumeX, X } from 'lucide-react';
import { toast } from 'sonner';

// Global TTS toggle — persisted in localStorage
export function useTTSEnabled() {
  const [enabled, setEnabled] = useState(() => localStorage.getItem('ccg_tts') === 'true');
  const toggle = () => setEnabled(v => {
    localStorage.setItem('ccg_tts', !v);
    return !v;
  });
  return [enabled, toggle];
}

// Hook: speak any text if TTS is on
export function useSpeakText() {
  const [ttsEnabled] = useTTSEnabled();
  return useCallback((text) => {
    if (!ttsEnabled || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.rate = 0.95;
    window.speechSynthesis.speak(utt);
  }, [ttsEnabled]);
}

// Floating voice toolbar shown at bottom of screen
export default function VoiceToolbar({ onTranscript }) {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [ttsEnabled, toggleTTS] = useTTSEnabled();
  const recognitionRef = useRef(null);

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const supported = !!SpeechRecognition;

  const startListening = () => {
    if (!supported) { toast.error('Speech recognition not supported on this browser'); return; }
    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-GB';
    rec.onresult = (e) => {
      let interim = '';
      let final = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t;
        else interim += t;
      }
      setTranscript(final || interim);
    };
    rec.onerror = (e) => {
      toast.error('Microphone error: ' + e.error);
      setListening(false);
    };
    rec.onend = () => setListening(false);
    rec.start();
    recognitionRef.current = rec;
    setListening(true);
    setTranscript('');
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    setListening(false);
  };

  const insertTranscript = () => {
    if (transcript && onTranscript) onTranscript(transcript);
    setTranscript('');
  };

  return (
    <div className="fixed bottom-20 right-4 z-40 flex flex-col items-end gap-2">
      {/* Transcript bubble */}
      {(listening || transcript) && (
        <div className="bg-card border border-border rounded-xl shadow-lg p-3 max-w-xs w-64">
          <p className="text-xs text-muted-foreground mb-1">{listening ? '🎙 Listening...' : 'Transcript'}</p>
          <p className="text-sm min-h-[2rem]">{transcript || '...'}</p>
          {transcript && !listening && (
            <div className="flex gap-2 mt-2">
              <button onClick={insertTranscript} className="flex-1 px-2 py-1 text-xs bg-primary text-white rounded font-medium hover:bg-primary/90">
                Insert
              </button>
              <button onClick={() => setTranscript('')} className="px-2 py-1 text-xs bg-muted rounded hover:bg-muted/70">
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Control buttons */}
      <div className="flex gap-2">
        {/* TTS toggle */}
        <button
          onClick={toggleTTS}
          title={ttsEnabled ? 'Disable text-to-speech' : 'Enable text-to-speech'}
          className={`w-11 h-11 rounded-full shadow-lg flex items-center justify-center transition-colors ${ttsEnabled ? 'bg-blue-600 text-white' : 'bg-card border border-border text-muted-foreground'}`}
        >
          {ttsEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
        </button>

        {/* Mic button */}
        {supported && (
          <button
            onClick={listening ? stopListening : startListening}
            title={listening ? 'Stop recording' : 'Start voice input'}
            className={`w-11 h-11 rounded-full shadow-lg flex items-center justify-center transition-colors ${listening ? 'bg-red-500 text-white animate-pulse' : 'bg-primary text-white'}`}
          >
            {listening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>
        )}
      </div>
    </div>
  );
}