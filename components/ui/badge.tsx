import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cn } from '@/lib/utils'

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline'
  asChild?: boolean
}

const getBadgeClasses = ({ variant = 'default', className }: Partial<BadgeProps>) => {
  const baseClasses = 'inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive transition-[color,box-shadow] overflow-hidden'

  const variantClasses = {
    default: 'border-transparent bg-primary text-primary-foreground [a&]:hover:bg-primary/90',
    secondary: 'border-transparent bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90',
    destructive: 'border-transparent bg-destructive text-white [a&]:hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60',
    outline: 'text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground',
  }

  return cn(
    baseClasses,
    variantClasses[variant] || variantClasses.default,
    className
  )
}

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: BadgeProps) {
  const Comp = asChild ? Slot : 'span'

  return (
    <Comp
      data-slot="badge"
      className={getBadgeClasses({ variant, className })}
      {...props}
    />
  )
}

export { Badge }
