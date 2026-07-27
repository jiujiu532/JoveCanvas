import { cn } from "@/lib/utils";

export function SiteLogo({ logoUrl, className }: { logoUrl: string; className?: string }) {
    const src = logoUrl || "/logo.svg";
    return <img src={src} alt="" className={cn("shrink-0 object-contain", className)} referrerPolicy="no-referrer" />;
}
