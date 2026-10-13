import { Link } from "react-router";
import { usePreferences } from "../../context/PreferencesContext";

import "../../styles/points-badge.css";

export default function PointsBadge({ amount, to, onClick }) {
  const { language } = usePreferences();

  const label = language === "ar" ? "نقطة" : "points";
  const balanceLabel =
    language === "ar" ? "رصيد النقاط" : "Points balance";

  const formatted =
    Number.isFinite(amount) && amount >= 0
      ? new Intl.NumberFormat(
          language === "ar" ? "ar-EG" : "en-US",
        ).format(amount)
      : "—";

  const content = (
    <>

      <strong className="points-badge-number" dir="ltr">
        {formatted}
      </strong>

      <span className="points-badge-label">{label}</span>
    </>
  );

  const accessibleLabel =
    `${balanceLabel}: ${formatted} ${label}`;

  return to ? (
    <Link
      className="points-badge"
      to={to}
      onClick={onClick}
      aria-label={accessibleLabel}
    >
      {content}
    </Link>
  ) : (
    <span
      className="points-badge"
      aria-label={accessibleLabel}
    >
      {content}
    </span>
  );
}
