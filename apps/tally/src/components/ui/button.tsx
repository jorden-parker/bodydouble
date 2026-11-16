import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-2 rounded-md border border-transparent text-sm font-medium whitespace-nowrap select-none outline-none transition-[transform,box-shadow,background-color,color] duration-150 ease-[var(--ease-spring)] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5",
  {
    variants: {
      variant: {
        neon: "bg-neon text-background hover:opacity-90",
        soft: "border-line bg-surface-2 text-foreground hover:bg-surface-3",
        ghost:
          "text-muted-foreground hover:bg-surface-2 hover:text-foreground aria-expanded:bg-surface-2 aria-expanded:text-foreground",
        destructive: "bg-tint-coral text-ink-coral hover:bg-tint-coral/80",
        link: "min-h-0 text-ink-blue underline-offset-4 hover:underline",
      },
      size: {
        default: "min-h-11 px-6",
        sm: "min-h-11 px-4 text-sm",
        lg: "min-h-12 px-6 text-base",
        icon: "size-11 px-0",
      },
    },
    defaultVariants: {
      variant: "neon",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "neon",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
