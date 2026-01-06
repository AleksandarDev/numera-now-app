import { AccountName } from "@/components/account-name";
import { Row } from "@signalco/ui-primitives/Row";
import { Typography } from "@signalco/ui-primitives/Typography";
import { ChevronRight } from "lucide-react";
import { ValidationIndicator } from "./validation-indicator";

type AccountColumnProps = {
  account?: string | null;
  accountCode?: string | null;
  accountIsOpen?: boolean | null;
  creditAccount?: string | null;
  creditAccountCode?: string | null;
  creditAccountIsOpen?: boolean | null;
  debitAccount?: string | null;
  debitAccountCode?: string | null;
  debitAccountIsOpen?: boolean | null;
};

export const AccountColumn = ({ 
  account, 
  accountCode, 
  accountIsOpen,
  creditAccount, 
  creditAccountCode, 
  creditAccountIsOpen,
  debitAccount, 
  debitAccountCode,
  debitAccountIsOpen 
}: AccountColumnProps) => {
  if (account)
    return (
      <Row spacing={1}>
        {accountIsOpen === false && (
          <ValidationIndicator 
            message={`Account "${account}" is closed/inactive`}
            severity="warning"
          />
        )}
        <AccountName account={account} accountCode={accountCode} />
      </Row>
    );

  if (creditAccount && debitAccount)
  return (
    <Row spacing={1}>
      {creditAccountIsOpen === false && (
        <ValidationIndicator 
          message={`Credit account "${creditAccount}" is closed/inactive`}
          severity="warning"
        />
      )}
      <AccountName account={creditAccount} accountCode={creditAccountCode} />
      <ChevronRight className="size-4 min-w-4" />
      {debitAccountIsOpen === false && (
        <ValidationIndicator 
          message={`Debit account "${debitAccount}" is closed/inactive`}
          severity="warning"
        />
      )}
      <AccountName account={debitAccount} accountCode={debitAccountCode} />
    </Row>
  );

  return <Typography level="body1" semiBold color="danger">Invalid accounts</Typography>;
};