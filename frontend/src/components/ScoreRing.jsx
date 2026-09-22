export default function ScoreRing({ score, size = 120, innerSize = 96, gradient, children }) {
  const bg = gradient || `conic-gradient(var(--primary) 0% ${score}%, var(--hairline) ${score}% 100%)`;
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 9999,
        background: bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flex: 'none',
      }}
    >
      <div
        style={{
          width: innerSize,
          height: innerSize,
          borderRadius: 9999,
          background: 'var(--canvas)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {children}
      </div>
    </div>
  );
}
