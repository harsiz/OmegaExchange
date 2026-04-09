import { getCurrency } from '@/lib/utils'

const LOGO_URLS = {
  BTC:  'https://assets.coingecko.com/coins/images/1/thumb/bitcoin.png',
  ETH:  'https://assets.coingecko.com/coins/images/279/thumb/ethereum.png',
  SOL:  'https://assets.coingecko.com/coins/images/4128/thumb/solana.png',
  USDT: 'https://assets.coingecko.com/coins/images/325/thumb/Tether.png',
  USDC: 'https://assets.coingecko.com/coins/images/6319/standard/USDC.png?1769615602',
  LTC:  'https://assets.coingecko.com/coins/images/2/thumb/litecoin.png',
  BCH:  'https://assets.coingecko.com/coins/images/780/standard/bitcoin-cash-circle.png?1696501932',
}

export function CryptoIcon({ symbol, size = 28, className = '' }) {
  const currency = getCurrency(symbol)
  const src = LOGO_URLS[symbol]

  if (src) {
    return (
      <img
        src={src}
        alt={symbol}
        width={size}
        height={size}
        className={`rounded-full object-cover flex-shrink-0 ${className}`}
        style={{ width: size, height: size }}
        onError={e => { e.currentTarget.style.display = 'none'; e.currentTarget.nextSibling?.style.removeProperty('display') }}
      />
    )
  }

  return (
    <span
      className={`inline-flex items-center justify-center rounded-full text-white font-bold flex-shrink-0 ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.4, backgroundColor: currency.color }}
    >
      {symbol.slice(0, 1)}
    </span>
  )
}

export function CryptoTag({ symbol }) {
  const currency = getCurrency(symbol)
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ backgroundColor: currency.bgColor, color: currency.color }}
    >
      <CryptoIcon symbol={symbol} size={14} />
      {symbol}
    </span>
  )
}
