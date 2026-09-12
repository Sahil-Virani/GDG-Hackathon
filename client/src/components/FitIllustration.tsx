export function FitIllustration({ variant = 0 }: { variant?: number }) {
  const colors =
    variant === 0
      ? ['#c0c7b5', '#515d50', '#161e21']
      : variant === 1
        ? ['#bec9de', '#9ba8ba', '#353e50']
        : ['#b8a58f', '#786554', '#222527'];
  return (
    <svg
      viewBox="0 0 300 470"
      aria-label="Illustrated fit example"
      role="img"
      className="fit-illustration"
    >
      <defs>
        <linearGradient id={`j${variant}`} x2="1" y2="1">
          <stop stopColor={colors[0]} />
          <stop offset="1" stopColor={colors[1]} />
        </linearGradient>
        <radialGradient id={`bg${variant}`}>
          <stop stopColor={colors[1]} stopOpacity=".45" />
          <stop offset="1" stopColor="#111d20" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="150" cy="230" rx="140" ry="220" fill={`url(#bg${variant})`} />
      <ellipse cx="150" cy="444" rx="74" ry="10" fill="#000" opacity=".3" />
      <path d="M125 273l-8 155 27 4 12-126 9 126 29-3-15-157z" fill={colors[2]} />
      <path d="M114 420l-15 17q-2 10 15 10h32v-25M166 421l2 25h41q9-4 1-12l-20-14" fill="#e2e1d6" />
      <path d="M130 68v35l22 19 20-22V66" fill="#b8a99a" />
      <ellipse cx="151" cy="55" rx="28" ry="35" fill="#c3b3a3" />
      <path d="M121 53q-6-45 32-43 33 0 29 44l-11-24-47 10z" fill="#252a28" />
      <path
        d="M129 97l-34 14-32 130 21 9 27-91-2 131q38 13 77 0l-4-130 27 91 22-12-32-127-29-15-20 21z"
        fill={`url(#j${variant})`}
      />
      <path d="M130 98l20 20 21-20-6 185h-29z" fill={variant === 1 ? '#e4e4df' : '#26342e'} />
      <path
        d="M127 99l-13 27 22 20-5 12 18 35 1-75M173 99l13 29-22 17 6 15-19 31"
        fill={colors[0]}
        stroke={colors[1]}
        strokeWidth="1"
      />
      <path
        d="M113 215l25 2-2 31-24-2M166 217l18-2 1 31-19 2"
        fill="none"
        stroke={colors[1]}
        strokeWidth="2"
      />
      <path d="M65 239l-4 20q0 16 11 14l12-24M209 246l7 23q10 7 15-7l-2-23" fill="#b8a99a" />
      <path d="M122 49l27 3 3 10-26-3zm32 3l24-2-2 11-23 1z" fill="#202926" />
      <path d="M135 340l-9 81M179 340l8 80" stroke="#65706b" opacity=".3" />
      <path d="M75 228l12 4M207 233l15-6" stroke={colors[0]} strokeWidth="2" />
    </svg>
  );
}
