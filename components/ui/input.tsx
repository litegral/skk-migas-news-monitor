import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"
import { EyeIcon, EyeOffIcon } from "lucide-react"

import { cn } from "@/lib/utils"

interface InputProps extends React.ComponentProps<"input"> {
  inputClassName?: string
  hasError?: boolean
}

function Input({
  className,
  inputClassName,
  hasError,
  type,
  ...props
}: InputProps) {
  const [passwordVisible, setPasswordVisible] = React.useState(false)
  const isPassword = type === "password"

  const field = (
    <InputPrimitive
      type={isPassword && passwordVisible ? "text" : type}
      data-slot="input"
      aria-invalid={hasError || undefined}
      className={cn(
        "h-10 w-full min-w-0 rounded-lg border border-input bg-transparent px-3 py-1 text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        isPassword && "pr-10",
        inputClassName,
        !isPassword && className
      )}
      {...props}
    />
  )

  if (!isPassword) return field

  return (
    <div className={cn("relative w-full", className)}>
      {field}
      <button
        type="button"
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
        onClick={() => setPasswordVisible((visible) => !visible)}
        aria-label={passwordVisible ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
      >
        {passwordVisible ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
      </button>
    </div>
  )
}

export { Input, type InputProps }
