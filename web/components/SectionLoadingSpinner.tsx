import React from "react";

export function SectionLoadingSpinner() {
  return (
    <div className="tests-page-section-loading" aria-label="Loading">
      <span
        className="bulby-thinking-spinner bulby-thinking-spinner--section"
        aria-hidden="true"
      />
    </div>
  );
}
