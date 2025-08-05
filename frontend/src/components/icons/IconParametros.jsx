// src/components/icons/IconParametros.jsx

export default function IconParametros({
  className = "w-5 h-5 mr-2 text-green-400",
}) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M12 6v6l4 2"
      />
      <circle cx="12" cy="12" r="10" strokeWidth="2" />
    </svg>
  );
}
