import { ClerkLoaded, ClerkLoading, UserButton } from '@clerk/nextjs';
import { Loader2 } from 'lucide-react';
import { Suspense } from 'react';
import { Filters } from './filters';
import { HeaderLogo } from './header-logo';
import { Navigation, SettingsNav } from './navigation';

export const Header = () => {
    return (
        <header className="bg-black shadow-2xl p-4 pb-16 lg:px-14 lg:pb-32">
            <div className="mx-auto max-w-screen-2xl">
                <div className="mb-4 lg:mb-6 flex w-full items-center justify-between">
                    <div className="flex items-center lg:gap-x-4">
                        <HeaderLogo />
                        <Suspense>
                            <Navigation />
                        </Suspense>
                    </div>

                    <div className="flex items-center gap-x-2">
                        <Suspense>
                            <SettingsNav />
                        </Suspense>

                        <ClerkLoaded>
                            <UserButton />
                        </ClerkLoaded>

                        <ClerkLoading>
                            <Loader2 className="size-8 animate-spin text-slate-400" />
                        </ClerkLoading>
                    </div>
                </div>

                <Suspense>
                    <Filters />
                </Suspense>
            </div>
        </header>
    );
};
