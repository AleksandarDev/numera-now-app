import Link from "next/link";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";
import { Badge } from "./ui/badge";

type Props = {
    href: string;
    query?: string;
    label: string;
    isActive?: boolean;
    badge?: number;
};

export const NavButton = ({
    href,
    query,
    label,
    isActive,
    badge,
}: Props) => {
    return (
        <Link href={{
            pathname: href,
            query
        }}>
            <Button
                size="sm"
                variant="outline"
                className={cn(
                    "w-full lg:w-auto justify-between font-normal hover:bg-white/20 hover:text-white border-none focus-visible:ring-offset-0 focus-visible:ring-transparent outline-none text-white focus:bg-white/30 transition",
                    isActive ? "bg-white/10 text-white" : "bg-transparent",
                )}
            >
                <span className="flex items-center gap-2">
                    {label}
                    {badge !== undefined && badge > 0 && (
                        <Badge variant="destructive" className="ml-1 h-5 min-w-5 flex items-center justify-center px-1.5">
                            {badge}
                        </Badge>
                    )}
                </span>
            </Button>
        </Link>
    );
};