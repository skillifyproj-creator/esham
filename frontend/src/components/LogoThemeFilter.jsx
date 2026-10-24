// The wordmark occupies the left 58.5% of the transparent source asset.
// Soften the letters for dark surfaces while retaining the illustration's original colors.
export default function LogoThemeFilter() {
  return <svg width="0" height="0" aria-hidden="true" focusable="false" style={{position:'absolute',pointerEvents:'none'}}>
    <defs><filter id="esham-light-wordmark" x="0" y="0" width="1" height="1" filterUnits="objectBoundingBox" primitiveUnits="objectBoundingBox" colorInterpolationFilters="sRGB">
      <feFlood x="0" y="0" width="0.585" height="1" floodColor="#d8c9cc" result="wordmark-white" />
      <feComposite in="wordmark-white" in2="SourceAlpha" operator="in" result="wordmark" />
      <feMerge><feMergeNode in="SourceGraphic" /><feMergeNode in="wordmark" /></feMerge>
    </filter></defs>
  </svg>;
}
