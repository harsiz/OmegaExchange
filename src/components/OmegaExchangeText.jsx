/**
 * Renders "OmegaExchange" with "Omega" in white and "Exchange" in brand blue.
 * Uses font-heading (Geologica) — never the bubbly Sniglet brand font.
 */
export default function OmegaExchangeText({ className = '' }) {
  return (
    <span className={`font-heading font-bold ${className}`}>
      <span className="text-white">Omega</span>
      <span className="text-brand-400">Exchange</span>
    </span>
  )
}
