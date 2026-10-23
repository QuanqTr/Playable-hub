import * as React from "react";
import { cn } from "@/lib/utils";
export const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(({ className, type, ...props }, ref) => <input ref={ref} type={type} className={cn("flex h-10 w-full min-w-0 rounded-lg border border-input bg-white px-3 py-2 text-sm shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-red-500", className)} {...props} />);
Input.displayName = "Input";
