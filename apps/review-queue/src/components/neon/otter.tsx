import { cn } from "cn";

const SIZE_CLASSES = {
  small: "text-2xl",
  medium: "text-4xl",
  large: "text-6xl",
} as const;

type OtterProps = {
  size?: keyof typeof SIZE_CLASSES;
  isFloating?: boolean;
  className?: string;
};

export function Otter({ size = "medium", isFloating = false, className }: OtterProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-block shrink-0 leading-none select-none hover:animate-wiggle",
        SIZE_CLASSES[size],
        isFloating && "animate-float",
        className,
      )}
    >
      🦦
    </span>
  );
}
