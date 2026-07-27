import { cn } from "@/lib/utils";
import { DEFAULT_BRAND_LOGO_PATH, withBrandAssetVersion } from "@/lib/brand-assets";

export function SiteLogo({ logoUrl, className }: { logoUrl: string; className?: string }) {
    const src = withBrandAssetVersion(logoUrl || DEFAULT_BRAND_LOGO_PATH);
    return <img src={src} alt="" className={cn("shrink-0 object-contain", className)} referrerPolicy="no-referrer" />;
}
