const paths = {
  moon: <path d="M21 13A9 9 0 0 1 11 3a9 9 0 1 0 10 10Z" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" />
    </>
  ),
  leaf: (
    <>
      <path d="M20 4C10 3 3 7 5 14s12 6 15-10Z" />
      <path d="m4 21 12-12M8 17v-5m4 1h5" />
    </>
  ),
  code: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m7 9 3 3-3 3m6 0h4" />
    </>
  ),
  camera: (
    <>
      <path d="M8 6 9 3h6l1 3h4v15H4V6Z" />
      <circle cx="12" cy="13" r="4" />
    </>
  ),
  design: (
    <>
      <path d="m4 20 6-6m4-4 6-6M4 4l16 16M3 9l6-6m6 18 6-6" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  chart: (
    <>
      <path d="M4 20V4m0 16h17M8 16v-4m5 4V8m5 8V5" />
    </>
  ),
  coins: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M15 8h-4a2 2 0 0 0 0 4h2a2 2 0 0 1 0 4H9m3-10v12" />
    </>
  ),
  swap: (
    <>
      <path d="M3 7h17l-4-4m5 14H4l4 4M20 7l-4 4M4 17l4-4" />
    </>
  ),
  grid: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </>
  ),
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21v-3a8 8 0 0 1 16 0v3" />
    </>
  ),
  book: (
  <>
    <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5Z" />
    <path d="M4 5.5v16M8 7h8M8 11h8" />
  </>
),

users: (
  <>
    <circle cx="9" cy="8" r="3" />
    <path d="M3 20v-2a6 6 0 0 1 12 0v2" />
    <path d="M16 5.5a3 3 0 0 1 0 5.8M18 20v-2a5 5 0 0 0-2.5-4.3" />
  </>
),

star: (
  <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z" />
),

video: (
  <>
    <rect x="3" y="5" width="13" height="14" rx="2" />
    <path d="m16 10 5-3v10l-5-3Z" />
  </>
),

history: (
  <>
    <path d="M3 12a9 9 0 1 0 3-6.7" />
    <path d="M3 4v5h5" />
    <path d="M12 7v5l3 2" />
  </>
),

plus: (
  <>
    <path d="M12 5v14M5 12h14" />
  </>
),

lesson: (
  <>
    <rect x="4" y="3" width="16" height="18" rx="2" />
    <path d="M8 8h8M8 12h8M8 16h5" />
  </>
),

award: (
  <>
    <circle cx="12" cy="8" r="5" />
    <path d="m9 12-1 9 4-2 4 2-1-9" />
    <path d="m10 8 1.4 1.4L14 7" />
  </>
),
  save: (
    <>
      <path d="M5 3h11l3 3v15H5Z" />
      <path d="M8 3v6h8V3" />
      <path d="M8 21v-7h8v7" />
    </>
  ),

  "arrow-left": (
    <>
      <path d="M19 12H5" />
      <path d="m12 5-7 7 7 7" />
    </>
  ),

  cloud: (
    <>
      <path d="M17.5 19H8a5 5 0 1 1 1.3-9.8A6 6 0 0 1 21 12.5 3.5 3.5 0 0 1 17.5 19Z" />
    </>
  ),

  "chevron-down": (
    <path d="m6 9 6 6 6-6" />
  ),

  check: (
    <path d="m5 12 4 4L19 6" />
  ),

  trash: (
    <>
      <path d="M4 7h16" />
      <path d="M10 11v6M14 11v6" />
      <path d="M6 7l1 14h10l1-14" />
      <path d="M9 7V4h6v3" />
    </>
  ),

  image: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="8.5" cy="9" r="1.5" />
      <path d="m3 17 5-5 4 4 3-3 6 6" />
    </>
  ),

  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5" />
      <path d="M12 8h.01" />
    </>
  ),

  "shield-check": (
    <>
      <path d="M12 3 19 6v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6Z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
    search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 5 5" />
    </>
  ),

  eye: (
    <>
      <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
      <circle cx="12" cy="12" r="2.5" />
    </>
  ),

  "eye-off": (<><path d="m3 3 18 18M10.6 6.1A12 12 0 0 1 12 6c6 0 9.5 6 9.5 6a17 17 0 0 1-3 3.6M6.3 6.3A18 18 0 0 0 2.5 12s3.5 6 9.5 6a12 12 0 0 0 5.7-1.7M10.2 10.2a2.5 2.5 0 0 0 3.6 3.6" /></>),
  edit: (
    <>
      <path d="M4 20h4L19 9l-4-4L4 16v4Z" />
      <path d="m13.5 6.5 4 4" />
    </>
  ),

  settings: (
    <>
      <path d="M9 3h6l.5 3 2 1 2.5-1 3 5-2.5 2v2l2.5 2-3 5-2.5-1-2 1-.5 3H9l-.5-3-2-1-2.5 1-3-5 2.5-2v-2L1 11l3-5 2.5 1 2-1Z" transform="translate(2 0) scale(.83)" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),};
export default function Icon({ name, size = 24, ...props }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {paths[name] || paths.grid}
    </svg>
  );
  
}
