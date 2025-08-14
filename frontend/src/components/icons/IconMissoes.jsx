// src/components/icons/IconMissoes.jsx

export default function IconMissoes({
  className = "w-5 h-5 mr-2 text-orange-500",
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className={className}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 20l-5-2.5V6l5 2.5L14 6l5 2.5v11l-5-2.5L9 20z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M14 6v11m-5-8v11" />
    </svg>
  );
}
