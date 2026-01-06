"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@signalco/ui-primitives/Card";
import { Button } from "@/components/ui/button";
import { Loader2, Plus } from "lucide-react";
import { Suspense } from "react";
import { useNewCategory } from "@/features/categories/hooks/use-new-category";
import { useGetCategories } from "@/features/categories/api/use-get-categories";
import { useBulkDeleteCategories } from "@/features/categories/api/use-bulk-delete-categories";
import { DataTable } from "@/components/data-table";
import { columns } from "../categories/columns";

function CategoriesSection() {
    const newCategory = useNewCategory();
    const deleteCategories = useBulkDeleteCategories();
    const categoriesQuery = useGetCategories();
    const categories = categoriesQuery.data || [];

    const isDisabled =
        categoriesQuery.isLoading ||
        deleteCategories.isPending;

    return (
        <Card>
            <CardHeader className="gap-y-2 lg:flex-row lg:items-center lg:justify-between">
                <CardTitle>
                    Categories
                </CardTitle>
                <Button onClick={newCategory.onOpen} size="sm">
                    <Plus className="size-4 mr-2" />
                    Add new
                </Button>
            </CardHeader>
            <CardContent>
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
            </CardContent>
        </Card>
    );
}

export default function SettingsPage() {
    return (
        <div className="mx-auto -mt-12 lg:-mt-24 w-full max-w-screen-2xl pb-10 space-y-4">
            <Suspense fallback={(
                <div className="flex h-[500px] w-full items-center justify-center">
                    <Loader2 className="size-6 animate-spin text-slate-300" />
                </div>
            )}>
                <CategoriesSection />
            </Suspense>
        </div>
    );
}