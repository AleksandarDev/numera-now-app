import { Loader2, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useGetCustomerIbans } from "@/features/customers/api/use-get-customer-ibans";
import { useCreateCustomerIban } from "@/features/customers/api/use-create-customer-iban";
import { useDeleteCustomerIban } from "@/features/customers/api/use-delete-customer-iban";
import { useConfirm } from "@/hooks/use-confirm";

type Props = {
    customerId: string;
    disabled?: boolean;
};

export const CustomerIbansManager = ({ customerId, disabled }: Props) => {
    const [newIban, setNewIban] = useState("");
    const [newBankName, setNewBankName] = useState("");

    const ibansQuery = useGetCustomerIbans(customerId);
    const createMutation = useCreateCustomerIban(customerId);
    const deleteMutation = useDeleteCustomerIban(customerId);

    const [ConfirmDialog, confirm] = useConfirm(
        "Delete IBAN?",
        "Are you sure you want to delete this IBAN?"
    );

    const handleAdd = () => {
        if (!newIban.trim()) return;
        
        createMutation.mutate(
            {
                iban: newIban.trim(),
                bankName: newBankName.trim() || undefined,
            },
            {
                onSuccess: () => {
                    setNewIban("");
                    setNewBankName("");
                },
            }
        );
    };

    const handleDelete = async (ibanId: string) => {
        const ok = await confirm();
        if (ok) {
            deleteMutation.mutate(ibanId);
        }
    };

    const isPending = createMutation.isPending || deleteMutation.isPending;

    return (
        <>
            <ConfirmDialog />
            <div className="space-y-4 pt-4">
                <div>
                    <h3 className="text-sm font-medium mb-3">Bank Accounts (IBANs)</h3>
                    
                    {ibansQuery.isLoading ? (
                        <div className="flex items-center justify-center py-4">
                            <Loader2 className="size-4 text-muted-foreground animate-spin" />
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {ibansQuery.data?.length === 0 && (
                                <p className="text-sm text-muted-foreground">
                                    No IBANs registered for this customer.
                                </p>
                            )}
                            {ibansQuery.data?.map((iban) => (
                                <div
                                    key={iban.id}
                                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                                >
                                    <div>
                                        <p className="text-sm font-mono">{iban.iban}</p>
                                        {iban.bankName && (
                                            <p className="text-xs text-muted-foreground">
                                                {iban.bankName}
                                            </p>
                                        )}
                                    </div>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        disabled={disabled || isPending}
                                        onClick={() => handleDelete(iban.id)}
                                    >
                                        <Trash2 className="size-4 text-destructive" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Add new IBAN</Label>
                    <div className="flex gap-2">
                        <div className="flex-1 space-y-2">
                            <Input
                                placeholder="IBAN (e.g., HR1234567890123456789)"
                                value={newIban}
                                onChange={(e) => setNewIban(e.target.value)}
                                disabled={disabled || isPending}
                                className="font-mono text-sm"
                            />
                            <Input
                                placeholder="Bank name (optional)"
                                value={newBankName}
                                onChange={(e) => setNewBankName(e.target.value)}
                                disabled={disabled || isPending}
                                className="text-sm"
                            />
                        </div>
                        <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={handleAdd}
                            disabled={disabled || isPending || !newIban.trim()}
                            className="self-start"
                        >
                            {createMutation.isPending ? (
                                <Loader2 className="size-4 animate-spin" />
                            ) : (
                                <Plus className="size-4" />
                            )}
                        </Button>
                    </div>
                </div>
            </div>
        </>
    );
};
