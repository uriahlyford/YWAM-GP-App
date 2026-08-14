/**
 * The app mark: a book under a roof. Drawn rather than imported so it inherits
 * `currentColor` and costs no request.
 */
export function SchoolMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      className={className}
      role="img"
      aria-hidden="true"
      fill="none"
    >
      <rect width="40" height="40" rx="11" fill="currentColor" />
      <g
        stroke="#fff"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M6.5 13.5 20 7.5l13.5 6L20 19.5 6.5 13.5Z" />
        <path d="M12 17v8.5c0 2.2 3.6 4 8 4s8-1.8 8-4V17" />
      </g>
    </svg>
  );
}
