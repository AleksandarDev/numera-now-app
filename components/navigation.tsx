"use client";

import { Menu } from "lucide-react";
import { useMedia } from "react-use";
import { usePathname, useSearchParams } from "next/navigation";
import { NavButton } from "./nav-button";
import { useState } from "react";
import { Button } from "./ui/button";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet";
import Link from "next/link";

const routes = [
    {
        href: "/",
        label: "Overview",
    },
    {
        href: "/transactions",
        label: "Transactions",
    },
    {
        href: "/accounts",
        label: "Accounts",
    },
    {
        href: "/categories",
        label: "Categories",
    },
    {
        href: "/settings",
        label: "Settings",
    },
]

export const Navigation = () => {
    const [isOpen, setIsOpen] = useState(false);

    const pathname = usePathname();
    const isMobile = useMedia("(max-width: 1024px)", false);
    const searchParams = useSearchParams();

    if (isMobile) {
        return (
            <Sheet open={isOpen} onOpenChange={setIsOpen}>
                <SheetTrigger asChild>
                    <Button
                        variant="outline"
                        size="sm"
                        className="font-normal bg-white/10 hover:bg-white/20 hover:text-white border-none focus-visible:ring-offset-0 focus-visible:ring-transparent outline-none text-white focus:bg-white/30 transition"
                        aria-label="Toggle navigation"
                    >
                        <Menu className="size-4" />
                    </Button>
                </SheetTrigger>
                <SheetContent side="left" className="px-2">
                    <SheetHeader>
                        <SheetTitle className="hidden">Navigation</SheetTitle>
                        <SheetDescription className="hidden">Quickly navigate to different sections</SheetDescription>
                    </SheetHeader>
                    <nav className="flex flex-col gap-y-2 pt-6">
                        {routes.map((route) => (
                            <Link
                                key={route.href}
                                href={{
                                    pathname: route.href,
                                    query: searchParams.toString()
                                }}
                                passHref
                                legacyBehavior
                                prefetch
                            >
                                <Button
                                    variant={route.href === pathname ? "secondary" : "ghost"}
                                    key={route.href}
                                    onClick={() => setIsOpen(false)}
                                    className="w-full justify-start"
                                >
                                    {route.label}
                                </Button>
                            </Link>
                        ))}
                    </nav>
                </SheetContent>
            </Sheet>
        );
    };

    return (
        <nav className="hidden lg:flex items-center gap-x-2 overflow-x-auto">
            {routes.map((route) => (
                <NavButton
                    key={route.href}
                    href={route.href}
                    query={searchParams.toString()}
                    label={route.label}
                    isActive={pathname === route.href}
                />
            ))}
        </nav>
    )
}