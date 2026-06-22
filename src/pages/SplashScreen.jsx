import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function SplashScreen() {
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Fade in
    const t1 = setTimeout(() => setVisible(true), 100);
    // After 3s redirect to login
    const t2 = setTimeout(() => navigate('/login'), 3200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [navigate]);

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#0e1117]">
      {/* Van wallpaper */}
      <img
        src="https://media.base44.com/images/public/6a388c0a71495eb772ec6ebb/fb5e7bdda_CookConstructionGrowthVan.png"
        alt="Cook Construction Growth"
        className="absolute inset-0 w-full h-full object-cover object-center"
        style={{ filter: 'brightness(0.45)' }}
      />

      {/* Gradient overlay — bottom fade to dark */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#0e1117] via-[#0e1117]/40 to-transparent" />

      {/* Content */}
      <div
        className="absolute inset-0 flex flex-col items-center justify-end pb-20 px-6 transition-all duration-1000"
        style={{ opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(16px)' }}
      >
        {/* Logo */}
        <img
          src="https://media.base44.com/images/public/6a388c0a71495eb772ec6ebb/fe81b6bc2_cookconstructiongrowthlogo.png"
          alt="Cook Construction Growth"
          className="w-64 mb-8 drop-shadow-2xl"
          style={{ filter: 'brightness(0) invert(1)' }}
        />

        <div className="text-center">
          <p className="text-white/60 text-sm font-medium tracking-widest uppercase mb-2">
            — Growth Partner for the Construction Industry —
          </p>
          <h1 className="text-white text-3xl font-bold leading-tight mb-8">
            CCG Connect
          </h1>
        </div>

        {/* Orange accent bar */}
        <div className="w-16 h-1 rounded-full bg-[#F97316] mb-10" />

        {/* Loading dots */}
        <div className="flex gap-2">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className="w-2 h-2 rounded-full bg-[#F97316]"
              style={{
                animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
              }}
            />
          ))}
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1.1); }
        }
      `}</style>
    </div>
  );
}