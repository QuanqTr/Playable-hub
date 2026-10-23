import * as React from "react";
import { cn } from "@/lib/utils";
export const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(({ className, ...props }, ref) => <textarea ref={ref} className={cn("flex min-h-24 w-full rounded-lg border border-input bg-white px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15 disabled:opacity-60", className)} {...props} />);
Textarea.displayName = "Textarea";
