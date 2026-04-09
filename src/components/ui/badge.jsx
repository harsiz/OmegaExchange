import * as React from 'react'
import { cva } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors',
  {
    variants: {
      variant: {
        default:     'bg-brand-600/20 text-brand-300 border border-brand-500/30',
        secondary:   'bg-navy-700 text-slate-300 border border-navy-600',
        destructive: 'bg-red-500/15 text-red-400 border border-red-500/25',
        outline:     'border border-navy-600 text-slate-400',
        success:     'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25',
        warning:     'bg-yellow-500/15 text-yellow-400 border border-yellow-500/25',
        pending:     'bg-yellow-500/15 text-yellow-400 border border-yellow-500/25',
        paid:        'bg-blue-500/15 text-blue-400 border border-blue-500/25',
        completed:   'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25',
        disputed:    'bg-red-500/15 text-red-400 border border-red-500/25',
        cancelled:   'bg-gray-500/15 text-gray-400 border border-gray-500/25',
      },
    },
    defaultVariants: { variant: 'default' },
  },
)

function Badge({ className, variant, ...props }) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
