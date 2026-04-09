import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-navy-900 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:     'bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800 shadow-sm shadow-brand-600/20',
        destructive: 'bg-red-600 text-white hover:bg-red-700',
        outline:     'border border-navy-600 bg-transparent text-slate-200 hover:bg-navy-800 hover:text-white hover:border-navy-500',
        secondary:   'bg-navy-700 text-slate-200 hover:bg-navy-600 hover:text-white',
        ghost:       'text-slate-400 hover:bg-navy-800 hover:text-slate-200',
        link:        'text-brand-400 underline-offset-4 hover:underline p-0 h-auto',
        success:     'bg-emerald-600 text-white hover:bg-emerald-700',
        white:       'bg-white text-navy-900 hover:bg-slate-100 shadow-sm font-bold',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm:      'h-8 px-3 text-xs',
        lg:      'h-12 px-6 text-base',
        xl:      'h-14 px-8 text-base',
        icon:    'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size:    'default',
    },
  },
)

const Button = React.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : 'button'
  return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
})
Button.displayName = 'Button'

export { Button, buttonVariants }
