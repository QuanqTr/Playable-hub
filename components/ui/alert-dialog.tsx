"use client";
import * as React from "react";
import * as Primitive from "@radix-ui/react-alert-dialog";
import { cn } from "@/lib/utils";
import { buttonVariants } from "./button";
export const AlertDialog = Primitive.Root;
export const AlertDialogTrigger = Primitive.Trigger;
export const AlertDialogPortal = Primitive.Portal;
export const AlertDialogContent = React.forwardRef<React.ComponentRef<typeof Primitive.Content>, React.ComponentPropsWithoutRef<typeof Primitive.Content>>(({ className, ...props }, ref) => <Primitive.Portal><Primitive.Overlay className="fixed inset-0 z-[80] bg-slate-950/30" /><Primitive.Content ref={ref} className={cn("fixed left-1/2 top-1/2 z-[81] grid w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl border bg-white p-6 shadow-xl", className)} {...props} /></Primitive.Portal>);
AlertDialogContent.displayName = "AlertDialogContent";
export function AlertDialogHeader(props: React.ComponentProps<"div">) { return <div className="space-y-3" {...props} />; }
export function AlertDialogFooter(props: React.ComponentProps<"div">) { return <div className="flex justify-end gap-2 pt-2" {...props} />; }
export const AlertDialogTitle = Primitive.Title;
export const AlertDialogDescription = Primitive.Description;
export const AlertDialogAction = React.forwardRef<React.ComponentRef<typeof Primitive.Action>, React.ComponentPropsWithoutRef<typeof Primitive.Action>>(({ className, ...props }, ref) => <Primitive.Action ref={ref} className={cn(buttonVariants(), className)} {...props} />);
AlertDialogAction.displayName = "AlertDialogAction";
export const AlertDialogCancel = React.forwardRef<React.ComponentRef<typeof Primitive.Cancel>, React.ComponentPropsWithoutRef<typeof Primitive.Cancel>>(({ className, ...props }, ref) => <Primitive.Cancel ref={ref} className={cn(buttonVariants({ variant: "outline" }), className)} {...props} />);
AlertDialogCancel.displayName = "AlertDialogCancel";
