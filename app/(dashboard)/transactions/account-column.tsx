import { AccountName } from "@/components/account-name";
import { Row } from "@signalco/ui-primitives/Row";
import { Typography } from "@signalco/ui-primitives/Typography";
import { ChevronRight } from "lucide-react";

type AccountColumnProps = {
  account?: string | null;
  accountCode?: string | null;
  creditAccount?: string | null;
  creditAccountCode?: string | null;
  debitAccount?: string | null;
  debitAccountCode?: string | null;
};

export const AccountColumn = ({ account, accountCode, creditAccount, creditAccountCode, debitAccount, debitAccountCode }: AccountColumnProps) => {
  if (account)
    return <AccountName account={account} accountCode={accountCode} />;

  if (creditAccount && debitAccount)
  return (
    <Row spacing={1}>
      <AccountName account={creditAccount} accountCode={creditAccountCode} />
      <ChevronRight className="size-4 min-w-4" />
      <AccountName account={debitAccount} accountCode={debitAccountCode} />
    </Row>
  );

  return <Typography level="body1" semiBold color="danger">Invalid accounts</Typography>;
};