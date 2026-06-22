import { Volume2 } from 'lucide-react';

// Wrap any text to make it speakable on tap (only active when TTS is enabled globally)
export default function SpeakableText({ children, className = '' }) {
  const ttsEnabled = localStorage.getItem('ccg_tts') === 'true';

  const speak = () => {
    if (!ttsEnabled || !window.speechSynthesis) return;
    const text = typeof children === 'string' ? children : '';
    if (!text) return;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.rate = 0.95;
    window.speechSynthesis.speak(utt);
  };

  if (!ttsEnabled) return <span className={className}>{children}</span>;

  return (
    <span
      className={`cursor-pointer group inline-flex items-center gap-0.5 ${className}`}
      onClick={speak}
      title="Tap to hear this"
    >
      {children}
      <Volume2 className="w-3 h-3 text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ml-0.5" />
    </span>
  );
}