import { client } from "@/lib/hono";

type LookupResult = {
    customerId: string;
    customerName: string;
    iban: string;
    bankName: string | null;
} | null;

export const lookupCustomerByIban = async (iban: string): Promise<LookupResult> => {
    const response = await client.api.customers["lookup"]["iban"].$get({
        query: { iban },
    });

    if (!response.ok) {
        return null;
    }

    const { data } = await response.json();
    return data;
};
