import Link from "next/link";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";

type Props = {
    href: string;
    query?: string;
    label: string;
    isActive?: boolean;
};

export const NavButton = ({
    href,
    query,
    label,
    isActive,
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
                {label}
            </Button>
        </Link>
    );
};