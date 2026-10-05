import { Link } from "react-router";
import { Fragment } from "react";
import Icon from "../../components/Icon";
import { usePreferences } from "../../context/PreferencesContext";
import instructorCopy from "../../i18n/instructorCopy";

export default function InstructorCourseStepper({ currentStep }) {
  const { language } = usePreferences();
  const c = instructorCopy[language].curriculum;

  const steps = [
    { title: c.stepOne, hint: c.stepOneHint },
    { title: c.stepTwo, hint: c.stepTwoHint },
    { title: c.stepThree, hint: c.stepThreeHint },
  ];

  return (
    <section
      className="instructor-course-stepper"
      aria-label={c.title}
    >
      {steps.map((step, index) => {
        const stepNumber = index + 1;
        const isComplete = stepNumber < currentStep;
        const isActive = stepNumber === currentStep;
        const state = isComplete
          ? "complete"
          : isActive
            ? "active"
            : "upcoming";

        return (
          <Fragment key={stepNumber}>
            <Link to={["/instructor/courses/new", "/instructor/courses/new/curriculum", "/instructor/courses/new/review"][index]} className={`instructor-course-step is-${state}`}
              aria-current={isActive ? "step" : undefined}
            >
              <span className="instructor-course-step-indicator">
                {isComplete ? (
                  <Icon name="check" size={14} />
                ) : (
                  stepNumber
                )}
              </span>

              <span className="instructor-course-step-copy">
                <strong>{step.title}</strong>
                <small>{step.hint}</small>
              </span>
            </Link>

            {index < steps.length - 1 && (
              <span
                className={`instructor-course-step-line${stepNumber < currentStep ? " is-complete" : ""}`}
                aria-hidden="true"
              />
            )}
          </Fragment>
        );
      })}
    </section>
  );
}
