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
};
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
