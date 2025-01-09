import Link from "next/link";
import Image from "next/image";

export const HeaderLogo = () => {
    return (
        <Link href="/" className="hidden lg:inline">
            <Image src="/NumeraNowLogomarkDark.svg" alt="logo" height={32} width={32} />
        </Link>
    )
}