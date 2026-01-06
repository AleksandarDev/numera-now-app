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
  creditAccountType?: string | null;
  debitAccount?: string | null;
  debitAccountCode?: string | null;
  debitAccountIsOpen?: boolean | null;
  debitAccountType?: string | null;
};

export const AccountColumn = ({
  account,
  accountCode,
  accountIsOpen,
  creditAccount,
  creditAccountCode,
  creditAccountIsOpen,
  creditAccountType,
  debitAccount,
  debitAccountCode,
  debitAccountIsOpen,
  debitAccountType
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
      <div className="grid grid-cols-[1fr_auto_1fr] gap-2">
        <Row spacing={1}>
          {creditAccountIsOpen === false && (
            <ValidationIndicator
              message={`Credit account "${creditAccount}" is closed/inactive`}
              severity="warning"
            />
          )}
          {creditAccountType === "debit" && (
            <ValidationIndicator
              message={`Credit account "${creditAccount}" is debit-only and should not be used as a credit account`}
              severity="error"
            />
          )}
          <AccountName account={creditAccount} accountCode={creditAccountCode} />
        </Row>
        <ChevronRight className="size-4 min-w-4" />
        <Row spacing={1}>
          {debitAccountIsOpen === false && (
            <ValidationIndicator
              message={`Debit account "${debitAccount}" is closed/inactive`}
              severity="warning"
            />
          )}
          {debitAccountType === "credit" && (
            <ValidationIndicator
              message={`Debit account "${debitAccount}" is credit-only and should not be used as a debit account`}
              severity="error"
            />
          )}
          <AccountName account={debitAccount} accountCode={debitAccountCode} />
        </Row>
      </div>
    );

  return <Typography level="body1" semiBold color="danger">Invalid accounts</Typography>;
};