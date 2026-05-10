'use client'

import * as React from 'react'
import * as SelectPrimitive from '@radix-ui/react-select'
import { Check, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'

// Radix-based Select with first-class support for rich items (image
// thumb + name + price). Lives next to the existing `select.tsx` (a
// native styled wrapper used by the long /order wizard) — they're two
// different tools, intentionally. Use this one when an option needs
// more than a string. Re-exports follow the shadcn naming convention
// (Select, SelectTrigger, etc.) so call sites read familiar.

export const RichSelect = SelectPrimitive.Root
export const RichSelectGroup = SelectPrimitive.Group
export const RichSelectValue = SelectPrimitive.Value

export const RichSelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      'flex h-12 w-full items-center justify-between gap-2 rounded-xl border border-cocoa-700/15 bg-cream-50 px-4 text-sm text-cocoa-900 shadow-sm transition-colors',
      'placeholder:text-cocoa-900/45',
      'focus:outline-none focus:border-sky focus:ring-2 focus:ring-sky/25',
      'disabled:cursor-not-allowed disabled:opacity-50',
      className,
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown className="h-4 w-4 opacity-60" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
))
RichSelectTrigger.displayName = SelectPrimitive.Trigger.displayName

const RichSelectScrollUpButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollUpButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollUpButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollUpButton
    ref={ref}
    className={cn('flex cursor-default items-center justify-center py-1', className)}
    {...props}
  >
    <ChevronUp className="h-4 w-4" />
  </SelectPrimitive.ScrollUpButton>
))
RichSelectScrollUpButton.displayName = SelectPrimitive.ScrollUpButton.displayName

const RichSelectScrollDownButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollDownButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollDownButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollDownButton
    ref={ref}
    className={cn('flex cursor-default items-center justify-center py-1', className)}
    {...props}
  >
    <ChevronDown className="h-4 w-4" />
  </SelectPrimitive.ScrollDownButton>
))
RichSelectScrollDownButton.displayName = SelectPrimitive.ScrollDownButton.displayName

export const RichSelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = 'popper', ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      position={position}
      className={cn(
        // z-[60] (not z-50) so we sit above the help-widget bubble + sticky
        // header without fighting other shadcn primitives.
        'relative z-[60] max-h-96 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-xl border border-cocoa-700/10 bg-white text-cocoa-900 shadow-lift',
        'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
        position === 'popper' &&
          'data-[side=bottom]:translate-y-1 data-[side=top]:-translate-y-1',
        className,
      )}
      {...props}
    >
      <RichSelectScrollUpButton />
      <SelectPrimitive.Viewport
        className={cn(
          'p-1.5',
          position === 'popper' &&
            'h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]',
        )}
      >
        {children}
      </SelectPrimitive.Viewport>
      <RichSelectScrollDownButton />
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
))
RichSelectContent.displayName = SelectPrimitive.Content.displayName

export const RichSelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      'relative flex w-full cursor-pointer select-none items-center gap-3 rounded-lg py-2 pl-3 pr-8 text-sm outline-none',
      'focus:bg-cream-100 data-[state=checked]:bg-sky/10 data-[state=checked]:text-sky-700',
      'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      className,
    )}
    {...props}
  >
    <span className="absolute right-2 flex h-3.5 w-3.5 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <Check className="h-4 w-4" />
      </SelectPrimitive.ItemIndicator>
    </span>
    <SelectPrimitive.ItemText asChild>
      <span className="flex items-center gap-3 w-full">{children}</span>
    </SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
))
RichSelectItem.displayName = SelectPrimitive.Item.displayName
