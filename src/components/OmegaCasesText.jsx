/**
 * Renders "OmegaCases" with "Omega" in white and "Cases" in brand blue.
 * Always uses the regular sans font — never the brand/bubbly Sniglet font.
 */
export default function OmegaCasesText({ className = '' }) {
  return (
    <span className={`font-sans ${className}`}>
      <span className="text-white">Omega</span>
      <span className="text-brand-400">Cases</span>
    </span>
  )
}
