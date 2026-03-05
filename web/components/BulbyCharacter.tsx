"use client";

import React from "react";

// Same lighting as first reference: dark circle, blue glow, light inner icon
const CIRCLE_FILL = "#2F374A";
const CIRCLE_GLOW = "#5C80B0";
const BULB_STROKE = "#bfdbfe";

/**
 * Lightbulb icon matching first reference: dark blue-grey filled circle,
 * prominent blue glow/border, light inner lightbulb outline.
 */
export function BulbyCharacter() {
  return (
    <div className="bulby-character" aria-hidden>
      <svg
        className="bulby-character-svg"
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Circle: dark fill + blue glow border (r=29 so stroke fits inside viewBox 0 0 64 64) */}
        <circle
          className="bulby-character-circle"
          cx="32"
          cy="32"
          r="29"
          fill={CIRCLE_FILL}
          stroke={CIRCLE_GLOW}
          strokeWidth="2"
        />
        {/* Lightbulb: light outline inside */}
        <path
          className="bulby-character-icon"
          d="M32 18c-6 0-11 5-11 11 0 5 3 9 7 11v2h8v-2c4-2 7-6 7-11 0-6-5-11-11-11z"
          stroke={BULB_STROKE}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <line
          className="bulby-character-icon"
          x1="26"
          y1="42"
          x2="38"
          y2="42"
          stroke={BULB_STROKE}
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <line
          className="bulby-character-icon"
          x1="28"
          y1="45"
          x2="36"
          y2="45"
          stroke={BULB_STROKE}
          strokeWidth="1.25"
          strokeLinecap="round"
        />
        <line
          className="bulby-character-icon"
          x1="30"
          y1="47.5"
          x2="34"
          y2="47.5"
          stroke={BULB_STROKE}
          strokeWidth="1"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}
