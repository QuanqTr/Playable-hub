"use client";
import * as React from "react";
import * as Primitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
export const Dialog = Primitive.Root;
export const DialogTrigger = Primitive.Trigger;
export const DialogClose = Primitive.Close;
export const DialogPortal = Primitive.Portal;
export const DialogOverlay = React.forwardRef<React.ComponentRef<typeof Primitive.Overlay>, React.ComponentPropsWithoutRef<typeof Primitive.Overlay>>(({ className, ...props }, ref) => <Primitive.Overlay ref={ref} className={cn("fixed inset-0 z-[60] bg-slate-950/30 backdrop-blur-[2px]", className)} {...props} />);
DialogOverlay.displayName = "DialogOverlay";
export const DialogContent = React.forwardRef<React.ComponentRef<typeof Primitive.Content>, React.ComponentPropsWithoutRef<typeof Primitive.Content>>(({ className, children, ...props }, ref) => <DialogPortal><DialogOverlay /><Primitive.Content ref={ref} className={cn("fixed left-1/2 top-1/2 z-[61] grid max-h-[92dvh] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 gap-5 overflow-y-auto rounded-xl border bg-white p-6 shadow-xl", className)} {...props}>{children}<Primitive.Close className="absolute right-4 top-4 flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary"><X size={18} /><span className="sr-only">Đóng</span></Primitive.Close></Primitive.Content></DialogPortal>);
DialogContent.displayName = "DialogContent";
export function DialogHeader({ className, ...props }: React.ComponentProps<"div">) { return <div className={cn("flex flex-col gap-2 pr-6", className)} {...props} />; }
export function DialogFooter({ className, ...props }: React.ComponentProps<"div">) { return <div className={cn("flex flex-wrap justify-end gap-2 pt-3", className)} {...props} />; }
export const DialogTitle = React.forwardRef<React.ComponentRef<typeof Primitive.Title>, React.ComponentPropsWithoutRef<typeof Primitive.Title>>(({ className, ...props }, ref) => <Primitive.Title ref={ref} className={cn("text-xl font-semibold tracking-tight", className)} {...props} />);
DialogTitle.displayName = "DialogTitle";
export const DialogDescription = React.forwardRef<React.ComponentRef<typeof Primitive.Description>, React.ComponentPropsWithoutRef<typeof Primitive.Description>>(({ className, ...props }, ref) => <Primitive.Description ref={ref} className={cn("text-sm leading-6 text-muted-foreground", className)} {...props} />);
DialogDescription.displayName = "DialogDescription";
