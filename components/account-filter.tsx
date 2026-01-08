"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import qs from "query-string";
import { AccountSelect } from "./account-select";

export const AccountFilter = () => {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const accountId = searchParams.get("accountId") || "all";

  const onChange = (newValue: string) => {
    const query = {
      accountId: newValue
    };

    if (newValue === "all") query.accountId = "";

    const url = qs.stringifyUrl(
      {
        url: pathname,
        query,
      },
      { skipNull: true, skipEmptyString: true }
    );

    router.push(url);
  };

  return (
    <AccountSelect
      value={accountId}
      onChange={onChange}
      selectAll
      className="min-w-72 h-9 rounded-md border-none bg-white/10 px-3 font-normal text-white outline-none transition hover:bg-white/30 hover:text-white focus:bg-white/30 focus:ring-transparent focus:ring-offset-0 md:w-auto text-left"
    />
  );
};