"use client";

import { Button } from "@/components/ui/button";
import { 
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@signalco/ui-primitives/Card";
import { useNewCategory } from "@/features/categories/hooks/use-new-category";
import { Loader2, Plus } from "lucide-react";
import { columns } from "./columns";
import { DataTable } from "@/components/data-table";
import { useGetCategories } from "@/features/categories/api/use-get-categories";
import { useBulkDeleteCategories } from "@/features/categories/api/use-bulk-delete-categories";
import { Suspense } from "react";

function CategoriesDataTable() {
    const deleteCategories = useBulkDeleteCategories();
    const categoriesQuery = useGetCategories();
    const categories = categoriesQuery.data || [];

    const isDisabled =
        categoriesQuery.isLoading ||
        deleteCategories.isPending;

    return (
        <DataTable
            filterKey="name"
            columns={columns}
            data={categories}
            onDelete={(row) => {
                const ids = row.map((r) => r.original.id);
                deleteCategories.mutate({ ids });
            }}
            disabled={isDisabled}
        />
    );
}

export default function CategoriesPage() {
    const newCategory = useNewCategory();

    return (
        <div className="max-w-screen-2xl mx-auto w-full pb-10 -mt-12 lg:-mt-24">
            <Card>
                <CardHeader className="gap-y-2 lg:flex-row lg:items-center lg:justify-between">
                    <CardTitle>
                        Categories Page
                    </CardTitle>
                    <Button onClick={newCategory.onOpen} size="sm">
                        <Plus className="size-4 mr-2" />
                        Add new
                    </Button>
                </CardHeader>
                <CardContent>
                    <Suspense fallback={(
                        <div className="h-[500px] w-full flex items-center justify-center">
                            <Loader2 className="size-6 text-slate-300 animate-spin" />
                        </div>
                    )}>
                        <CategoriesDataTable />
                    </Suspense>
                </CardContent>
            </Card>
        </div>
    );
}
