"use client";

import { useState } from "react";

// Shows text truncated to one line by default with a "Show more" toggle —
// used for table cells (site address, issue description, etc.) that can be
// long, so rows stay compact until the user asks to see the full value.
const SHOW_TOGGLE_THRESHOLD = 36;

export default function ExpandableText({ text, className = "" }: { text?: string | null; className?: string }) {
  const [expanded, setExpanded] = useState(false);

  if (!text) return null;

  const isLong = text.length > SHOW_TOGGLE_THRESHOLD;

  return (
    <div className={className}>
      <div className={expanded || !isLong ? "whitespace-normal break-words" : "truncate"}>{text}</div>
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-blue-600 hover:underline text-xs font-medium mt-0.5"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}
