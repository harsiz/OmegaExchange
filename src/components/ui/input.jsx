import * as React from 'react'
import { cn } from '@/lib/utils'

const Input = React.forwardRef(({ className, type, ...props }, ref) => (
  <input
    type={type}
    className={cn(
      'flex h-10 w-full rounded-lg border border-navy-600 bg-navy-800 px-3 py-2 text-sm text-white placeholder:text-slate-500',
      'focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent',
      'disabled:cursor-not-allowed disabled:opacity-50',
      'transition-colors',
      className,
    )}
    ref={ref}
    {...props}
  />
))
Input.displayName = 'Input'

export { Input }
