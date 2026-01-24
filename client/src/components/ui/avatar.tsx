import * as React from "react"

import { cn } from "@/lib/utils"

interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string | null
  alt?: string
  fallback?: string
  size?: "sm" | "md" | "lg" | "xl"
}

const sizeClasses = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-16 w-16 text-lg",
  xl: "h-24 w-24 text-2xl",
}

const Avatar = React.forwardRef<HTMLDivElement, AvatarProps>(
  ({ className, src, alt, fallback, size = "md", ...props }, ref) => {
    const [imageError, setImageError] = React.useState(false)

    const showFallback = !src || imageError

    const getFallbackText = () => {
      if (fallback) {
        return fallback.slice(0, 2).toUpperCase()
      }
      if (alt) {
        const words = alt.split(" ")
        if (words.length >= 2) {
          return (words[0][0] + words[1][0]).toUpperCase()
        }
        return alt.slice(0, 2).toUpperCase()
      }
      return "?"
    }

    return (
      <div
        ref={ref}
        className={cn(
          "relative flex shrink-0 overflow-hidden rounded-full bg-muted",
          sizeClasses[size],
          className
        )}
        {...props}
      >
        {showFallback ? (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-cyan-500 to-purple-500 font-medium text-white">
            {getFallbackText()}
          </div>
        ) : (
          <img
            src={src!}
            alt={alt || "Avatar"}
            className="aspect-square h-full w-full object-cover"
            onError={() => setImageError(true)}
          />
        )}
      </div>
    )
  }
)
Avatar.displayName = "Avatar"

export { Avatar }
