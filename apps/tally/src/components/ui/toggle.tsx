import { cva } from "class-variance-authority";

const toggleVariants = cva(
  "group/toggle inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-md px-4 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 aria-pressed:bg-surface-3 aria-pressed:text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        outline: "border border-line bg-transparent hover:bg-surface-2",
      },
      size: {
        default: "px-4",
        sm: "px-3 text-[0.8125rem]",
        lg: "px-5 text-base",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export { toggleVariants };
