"use client";

import { useMemo, useRef, useState } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { useGetAccounts } from "@/features/accounts/api/use-get-accounts";
import { AccountName } from "./account-name";
import { useVirtualizer } from "@tanstack/react-virtual";
import clsx from "clsx";
import { Input } from "./ui/input";
import { Typography } from "@signalco/ui-primitives/Typography";

export type AccountSelectProps = {
  value: string;
  onChange: (newValue: string) => void;
  selectAll?: boolean;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
};

export const AccountSelect = ({
  value, onChange, selectAll, className, placeholder, disabled
}: AccountSelectProps) => {
  const [open, setOpen] = useState(false);
  const [accountsFilter, setAccountsFilter] = useState("");

  // TODO: Don't load all accounts if filter is not open, load only the selected one
  const { data: accounts, isLoading: isLoadingAccounts } = useGetAccounts({
    pageSize: 9999,
    accountId: null
  });

  const resolvedAccounts = useMemo(() => selectAll
    ? [{ id: "all", name: "All accounts", code: "" }, ...(accounts ?? [])]
    : accounts, [accounts, selectAll]);
  const filteredAccounts = useMemo(() => resolvedAccounts?.filter((account) => {
    const filter = accountsFilter.toLowerCase();
    return account.name.toLowerCase().includes(filter) || account.code?.toLowerCase().includes(filter);
  }), [resolvedAccounts, accountsFilter]);

  // Virtualization
  const parentRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: (filteredAccounts ?? []).length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 45,
    enabled: !isLoadingAccounts && open,
    initialOffset: (filteredAccounts?.findIndex((account) => account.id === value) ?? 0) * 45,
  });

  const selectedAccount = ((value?.length ?? 0 > 0) && resolvedAccounts)
    ? resolvedAccounts.find((account) => account.id === value)
    : null;

  const shouldRefocus = useRef(false);
  return (
    <Select
      value={value}
      onValueChange={onChange}
      disabled={isLoadingAccounts || disabled}
      open={open}
      onOpenChange={setOpen}
    >
      <SelectTrigger className={clsx("text-left", className)}>
        {selectedAccount ? (
          <AccountName account={selectedAccount?.name} accountCode={selectedAccount?.code} />
        ) : (
          <span className="text-muted-foreground">{placeholder ?? "Select account"}</span>
        )}
      </SelectTrigger>
      <SelectContent
        viewportRef={parentRef}
        viewportClassName="overflow-auto max-h-96 min-w-80"
        startDecorator={(
          <div className="p-2">
            <Input
              autoFocus
              placeholder="Filter accounts..."
              value={accountsFilter}
              onFocus={() => {
                shouldRefocus.current = true;
              }}
              onBlur={(e) => {
                if (!shouldRefocus.current) return;
                e.currentTarget.focus();
              }}
              onChange={(e) => {
                e.stopPropagation();
                e.preventDefault();
                return setAccountsFilter(e.target.value);
              }} />
          </div>
        )}>
        {(filteredAccounts?.length ?? 0) <= 0 && (
          <Typography level="body2" className="p-2" secondary>
            No accounts found
          </Typography>
        )}
        <div
          className="relative w-full"
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
          }}>
          {rowVirtualizer.getVirtualItems().map((virtualItem) => {
            if (!filteredAccounts) return null;
            const account = filteredAccounts[virtualItem.index];
            return (
              <SelectItem key={virtualItem.key}
                value={account.id}
                className="text-left absolute left-0 top-0 w-full hover:bg-muted"
                style={{
                  height: `${virtualItem.size}px`,
                  transform: `translateY(${virtualItem.start}px)`,
                }}>
                <AccountName account={account.name} accountCode={account.code} />
              </SelectItem>
            );
          })}
        </div>
      </SelectContent>
    </Select>
  );
};