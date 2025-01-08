import Link from "next/link";
import Image from "next/image";

export const HeaderLogo = () => {
    return (
        <Link href="/">
            <div className="items-center hidden lg:flex">
                <Image src="/NumeraNowLight.svg" alt="logo" height={32} width={200} />
            </div>
        </Link>
    )
}