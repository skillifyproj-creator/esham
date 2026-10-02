import { useState } from "react";
import { Link, NavLink } from "react-router";
import Icon from "../Icon";
import logo from "../../assets/esham-logo.png";


const instructorLinks = [
  {
    to: "/instructor",
    label: "لوحة التحكم",
    end: true,
  },
  {
    to: "/instructor/courses",
    label: "دوراتي",
  },
  {
    to: "/instructor/courses/new",
    label: "إنشاء دورة",
  },
  {
    to: "/instructor/performance",
    label: "الأداء",
  },
  {
    to: "/instructor/feedback",
    label: "التقييمات",
  },
];


export default function InstructorNavigation() {
  const [open, setOpen] = useState(false);

  return (
    <header className="instructor-header">

      <div className="container learner-header-inner">

        {/* =================================
            Logo
        ================================= */}

        <Link
          to="/instructor"
          className="instructor-brand"
          onClick={() => setOpen(false)}
          aria-label="إسهام"
        >
          <img
            src={logo}
            alt="إسهام"
            className="instructor-logo"
          />
        </Link>


        {/* =================================
            Mobile Menu
        ================================= */}

        <button
          type="button"
          className="instructor-menu-button"
          onClick={() => setOpen((value) => !value)}
          aria-label={
            open
              ? "إغلاق القائمة"
              : "فتح القائمة"
          }
        >
          <Icon
            name={open ? "close" : "menu"}
            size={23}
          />
        </button>


        {/* =================================
            Navigation
        ================================= */}

        <nav
          className={
            open
              ? "instructor-navigation open"
              : "instructor-navigation"
          }
        >

          {instructorLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                isActive
                  ? "instructor-nav-link active"
                  : "instructor-nav-link"
              }
            >
              {link.label}
            </NavLink>
          ))}

        </nav>


        {/* =================================
            User Actions
        ================================= */}

        <div className="instructor-header-actions">

          {/* Switch to Learner */}

          <Link
            to="/learner"
            className="instructor-switch-role"
          >
            <Icon
              name="swap"
              size={17}
            />

            <span>
              التبديل إلى المتعلم
            </span>
          </Link>


          {/* Points */}

          <div className="instructor-points">

            <Icon
              name="star"
              size={16}
            />

            <strong>
              4,860
            </strong>

            <span>
              نقطة
            </span>

          </div>


          {/* Profile */}

          <Link
            to="/instructor/profile"
            className="instructor-profile"
          >
            <span className="instructor-profile-avatar">

              <Icon
                name="user"
                size={18}
              />

            </span>

            <span className="instructor-profile-copy">

              <strong>
                أحمد خالد
              </strong>

              <small>
                مدرب معتمد
              </small>

            </span>

          </Link>

        </div>

      </div>

    </header>
  );
}