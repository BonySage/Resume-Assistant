// Apple-style "liquid glass" distortion filters, applied via CSS `filter: url(#id)`
// on the nav backdrop, primary CTA buttons, and frosted cards.
export default function GlassFilters() {
  return (
    <svg style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }} aria-hidden="true">
      <filter id="glass-distortion" x="0%" y="0%" width="100%" height="100%" filterUnits="objectBoundingBox">
        <feTurbulence type="fractalNoise" baseFrequency="0.008 0.02" numOctaves="1" seed="7" result="turbulence" />
        <feComponentTransfer in="turbulence" result="mapped">
          <feFuncR type="gamma" amplitude="1" exponent="10" offset="0.5" />
          <feFuncG type="gamma" amplitude="0" exponent="1" offset="0" />
          <feFuncB type="gamma" amplitude="0" exponent="1" offset="0.5" />
        </feComponentTransfer>
        <feGaussianBlur in="turbulence" stdDeviation="2" result="softMap" />
        <feDisplacementMap in="SourceGraphic" in2="softMap" scale="18" xChannelSelector="R" yChannelSelector="G" />
      </filter>
      <filter
        id="glass-distortion-strong"
        x="-20%"
        y="-20%"
        width="140%"
        height="140%"
        filterUnits="objectBoundingBox"
      >
        <feTurbulence type="fractalNoise" baseFrequency="0.012 0.03" numOctaves="1" seed="9" result="turbulence" />
        <feComponentTransfer in="turbulence" result="mapped">
          <feFuncR type="gamma" amplitude="1" exponent="9" offset="0.4" />
          <feFuncG type="gamma" amplitude="0" exponent="1" offset="0" />
          <feFuncB type="gamma" amplitude="0" exponent="1" offset="0.5" />
        </feComponentTransfer>
        <feGaussianBlur in="turbulence" stdDeviation="3" result="softMap" />
        <feDisplacementMap in="SourceGraphic" in2="softMap" scale="34" xChannelSelector="R" yChannelSelector="G" />
      </filter>
      <filter id="glass-distortion-light" x="-10%" y="-10%" width="120%" height="120%" filterUnits="objectBoundingBox">
        <feTurbulence type="fractalNoise" baseFrequency="0.006 0.015" numOctaves="1" seed="5" result="turbulence" />
        <feComponentTransfer in="turbulence" result="mapped">
          <feFuncR type="gamma" amplitude="1" exponent="11" offset="0.55" />
          <feFuncG type="gamma" amplitude="0" exponent="1" offset="0" />
          <feFuncB type="gamma" amplitude="0" exponent="1" offset="0.5" />
        </feComponentTransfer>
        <feGaussianBlur in="turbulence" stdDeviation="2" result="softMap" />
        <feDisplacementMap in="SourceGraphic" in2="softMap" scale="9" xChannelSelector="R" yChannelSelector="G" />
      </filter>
    </svg>
  );
}
