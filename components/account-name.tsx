import { Stack } from "@signalco/ui-primitives/Stack";
import { Typography } from "@signalco/ui-primitives/Typography";

export function AccountName({ account, accountCode }: { account: string, accountCode?: string | null }) {
    return (
        <Stack alignItems="start">
            <Typography level="body1" className="line-clamp-1" title={account}>{account}</Typography>
            <Typography level="body2" mono className="leading-none">{accountCode}</Typography>
        </Stack>
    );
}