// Soft ocean-blue "liquid glass" wave, positioned behind the hero content.
export default function WaveHero() {
  return (
    <svg
      viewBox="0 0 1180 760"
      preserveAspectRatio="xMidYMid slice"
      style={{
        position: 'absolute',
        top: '-14%',
        right: '-24%',
        width: '92%',
        height: '140%',
        zIndex: 0,
        pointerEvents: 'none',
      }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="waveA" x1="10%" y1="0%" x2="95%" y2="100%">
          <stop offset="0%" stopColor="#E8F2FC" stopOpacity="0.95" />
          <stop offset="45%" stopColor="#C9E1F5" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#DCEBFA" stopOpacity="0.1" />
        </linearGradient>
        <linearGradient id="waveB" x1="20%" y1="5%" x2="90%" y2="95%">
          <stop offset="0%" stopColor="#D5E8F7" stopOpacity="0.85" />
          <stop offset="60%" stopColor="#DCEBFA" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#F7F7F5" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="waveD" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#C9E1F5" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#E8F2FC" stopOpacity="0.15" />
        </linearGradient>
        <linearGradient id="waveC" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.65" />
          <stop offset="100%" stopColor="#D5E8F7" stopOpacity="0" />
        </linearGradient>
        <filter id="waveBlurSoft" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="46" />
        </filter>
        <filter id="waveBlurTight" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="22" />
        </filter>
      </defs>
      <g filter="url(#waveBlurSoft)">
        <path
          d="M 60 700 C 320 560, 380 260, 700 190 C 940 140, 1040 20, 1180 -20 L 1180 760 L 60 760 Z"
          fill="url(#waveA)"
        />
        <path
          d="M 180 740 C 460 620, 520 320, 840 260 C 1020 226, 1100 100, 1180 60 L 1180 760 L 180 760 Z"
          fill="url(#waveD)"
        />
        <path
          d="M 300 700 C 540 600, 600 380, 900 330 C 1040 306, 1100 200, 1180 170 L 1180 760 L 300 760 Z"
          fill="url(#waveB)"
        />
      </g>
      <g filter="url(#waveBlurTight)">
        <path
          d="M 380 470 C 560 380, 660 240, 900 200 C 1010 182, 1090 120, 1180 100"
          fill="none"
          stroke="url(#waveC)"
          strokeWidth="34"
          strokeLinecap="round"
        />
        <path
          d="M 460 560 C 640 470, 720 320, 980 270"
          fill="none"
          stroke="url(#waveC)"
          strokeWidth="18"
          strokeLinecap="round"
          opacity="0.7"
        />
      </g>
    </svg>
  );
}
