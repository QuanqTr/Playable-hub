"use client";

import Link, { useLinkStatus } from "next/link";
import { forwardRef, useState, type ComponentPropsWithoutRef } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type PendingLinkProps = ComponentPropsWithoutRef<typeof Link> & {
  intentPrefetch?: boolean;
  loadingLabel?: string;
};

function LinkFeedback({ label }: { label: string }) {
  const { pending } = useLinkStatus();
  return <>
    <span className="link-pending-indicator" data-pending={pending} aria-hidden="true"><Loader2 size={13} /></span>
    {pending && <><span className="navigation-progress" aria-hidden="true" /><span className="sr-only" role="status">{label}</span></>}
  </>;
}

// Lists can contain many links. Fetch their data only when the user shows intent;
// the two primary destinations can opt into full viewport prefetching instead.
export const PendingLink = forwardRef<HTMLAnchorElement, PendingLinkProps>(function PendingLink({
  children, className, intentPrefetch = false, loadingLabel = "Đang mở trang…",
  prefetch, onMouseEnter, onFocus, ...props
}, ref) {
  const [hasIntent, setHasIntent] = useState(false);
  return <Link {...props} ref={ref} className={cn("pending-link", className)}
    prefetch={intentPrefetch ? (hasIntent ? true : false) : prefetch}
    onMouseEnter={event => { if (intentPrefetch) setHasIntent(true); onMouseEnter?.(event); }}
    onFocus={event => { if (intentPrefetch) setHasIntent(true); onFocus?.(event); }}>
    {children}<LinkFeedback label={loadingLabel} />
  </Link>;
});
