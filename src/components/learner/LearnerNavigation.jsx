import { useState } from "react";
import { NavLink, Link } from "react-router";

import { usePreferences } from "../../context/PreferencesContext";
import { learnerCopy } from "../../i18n/learnerCopy";

import Icon from "../Icon";
import logo from "../../assets/esham-logo.png";


export default function LearnerNavigation() {
  const { language } = usePreferences();
  const t = learnerCopy[language];

  const [open, setOpen] = useState(false);

  const links = [
    {
      to: "/learner",
      label: t.dashboard,
      end: true,
    },
    {
      to: "/learner/courses",
      label: t.myCourses,
    },
    {
      to: "/courses",
      label: "اكتشاف الدورات",
    },
    {
      to: "/learner/tasks",
      label: "المهام",
    },
    {
      to: "/learner/points",
      label: "النقاط",
    },
    {
      to: "/learner/reviews",
      label: "التقييمات",
    },
  ];

  return (
    <header className="learner-header">

      <div className="container learner-header-inner">

        {/* =========================
            Logo
        ========================= */}

        <Link
          to="/learner"
          className="learner-brand"
          onClick={() => setOpen(false)}
          aria-label="إسهام"
        >
          <img
            src={logo}
            alt="إسهام"
            className="learner-logo"
          />
        </Link>


        {/* =========================
            Mobile Menu
        ========================= */}

        <button
          type="button"
          className="learner-menu-button"
          onClick={() => setOpen((value) => !value)}
          aria-label={
            open
              ? "إغلاق القائمة"
              : "فتح القائمة"
          }
        >
          <Icon
            name={open ? "close" : "menu"}
            size={22}
          />
        </button>


        {/* =========================
            Navigation
        ========================= */}

        <nav
          className={
            open
              ? "learner-top-navigation open"
              : "learner-top-navigation"
          }
          aria-label={t.dashboard}
        >

          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                isActive
                  ? "learner-top-nav-link active"
                  : "learner-top-nav-link"
              }
            >
              {link.label}
            </NavLink>
          ))}

        </nav>


        {/* =========================
            Header Actions
        ========================= */}

        <div className="learner-header-actions">

          {/* Switch to Instructor */}

          <Link
            to="/instructor"
            className="learner-switch-role"
          >
            <span>
              التبديل إلى المعلم
            </span>

            <Icon
              name="swap"
              size={16}
            />
          </Link>


          {/* Points */}

          <Link
            to="/learner/points"
            className="learner-points"
          >
            <strong>
              200
            </strong>

            <span>
              نقطة
            </span>

            <Icon
              name="star"
              size={15}
            />
          </Link>


          {/* Profile */}

          <Link
            to="/learner/profile"
            className="learner-profile"
          >
            <span className="learner-profile-avatar">
              <Icon
                name="user"
                size={18}
              />
            </span>

            <span className="learner-profile-copy">

              <strong>
                أحمد خالد
              </strong>

              <small>
                متعلم
              </small>

            </span>
          </Link>

        </div>

      </div>

    </header>
  );
}