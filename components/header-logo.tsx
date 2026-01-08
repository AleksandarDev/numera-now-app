import Image from 'next/image';
import Link from 'next/link';

export const HeaderLogo = () => {
    return (
        <Link href="/" className="hidden lg:inline">
            <Image
                src="/NumeraNowLogomarkDark.svg"
                alt="logo"
                height={32}
                width={32}
                priority
            />
        </Link>
    );
};
