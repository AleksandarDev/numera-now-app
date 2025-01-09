import Link from "next/link";
import Image from "next/image";

export const HeaderLogo = () => {
    return (
        <Link href="/">
            <div className="items-center hidden lg:flex">
                <Image src="/NumeraNowDark.svg" alt="logo" height={39} width={200} />
            </div>
        </Link>
    )
}