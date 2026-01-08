import { useState } from "react";
import { Loader2 } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@signalco/ui-primitives/Card";
import { Button } from "@/components/ui/button";

import { ImportTable } from "./import-table";

// Helper to check if a value is an empty placeholder (NA, -, N/A, etc.)
const isEmptyPlaceholder = (value: string | null | undefined): boolean => {
  if (!value) return true;
  const trimmed = value.trim().toLowerCase();
  return ["-", "na", "n/a", "null", "none", "empty", ""].includes(trimmed);
};

type SelectedColumnsState = {
  [key: string]: string | null;
};

type ImportCardProps = {
  header: string;
  requiredOptions: string[];
  options: string[];
  data: string[][];
  onCancel: () => void;
  onSubmit: (data: any) => void;
  isImporting?: boolean;
};

export const ImportCard = ({ header, requiredOptions, options, data, onCancel, onSubmit, isImporting }: ImportCardProps) => {
  const [selectedColumns, setSelectedColumns] = useState<SelectedColumnsState>(
    {}
  );

  const headers = data[0] || [];
  const body = data.slice(1);

  // If no data, show message
  if (!data || data.length === 0 || headers.length === 0) {
    return (
      <div className="mx-auto -mt-12 lg:-mt-24 w-full max-w-screen-2xl pb-10">
        <Card>
          <CardHeader className="gap-y-2 lg:flex-row lg:items-center lg:justify-between">
            <CardTitle>{header}</CardTitle>
            <Button size="sm" onClick={onCancel} className="w-full lg:w-auto">
              Cancel
            </Button>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">No data found in the CSV file. Please check the file and try again.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const onTableHeadSelectChange = (
    columnIndex: number,
    value: string | null
  ) => {
    setSelectedColumns((prev) => {
      const newSelectedColumns = { ...prev };

      // Don't clear other columns with the same value - allow multiple columns for same property
      if (value === "skip") value = null;

      newSelectedColumns[`column_${columnIndex}`] = value;

      return newSelectedColumns;
    });
  };

  // Count unique non-null values for progress (multiple columns with same value count as 1)
  const uniqueSelectedOptions = new Set(Object.values(selectedColumns).filter(Boolean));
  const progress = uniqueSelectedOptions.size;

  const handleContinue = () => {
    const getColumnIndex = (column: string) => {
      return column.split("_")[1];
    };

    // map headers and body to the selected fields and set non-selected fields to null.
    const mappedData = {
      headers: headers.map((_header, index) => {
        const columnIndex = getColumnIndex(`column_${index}`);

        return selectedColumns[`column_${columnIndex}`] || null;
      }),
      body: body
        .map((row) => {
          const transformedRow = row.map((cell, index) => {
            const columnIndex = getColumnIndex(`column_${index}`);

            return selectedColumns[`column_${columnIndex}`] ? cell : null;
          });

          return transformedRow.every((item) => item === null)
            ? []
            : transformedRow;
        })
        .filter((row) => row.length > 0),
    };

    // Convert to array of objects, combining multiple columns with same property
    const arrayOfData = mappedData.body.map((row) => {
      return row.reduce((acc: any, cell, index) => {
        const header = mappedData.headers[index];

        if (header !== null) {
          // If property already exists, combine values (skip empty/placeholder values)
          if (acc[header] !== undefined) {
            const existingValue = acc[header];
            const newValue = cell;
            // Combine non-empty values with space
            if (existingValue && newValue && !isEmptyPlaceholder(newValue)) {
              acc[header] = `${existingValue} ${newValue}`.trim();
            } else if (!existingValue || isEmptyPlaceholder(existingValue)) {
              acc[header] = isEmptyPlaceholder(newValue) ? "" : newValue;
            }
          } else {
            acc[header] = isEmptyPlaceholder(cell) ? "" : cell;
          }
        }

        return acc;
      }, {});
    });

    const formattedData = arrayOfData.map((item) => ({
      ...item
    }));

    onSubmit(formattedData);
  };

  return (
    <div className="mx-auto -mt-12 lg:-mt-24 w-full max-w-screen-2xl pb-10">
      <Card>
        <CardHeader className="gap-y-2 lg:flex-row lg:items-center lg:justify-between">
          <CardTitle className="flex items-center gap-2">
            {header}
            {isImporting && <Loader2 className="size-4 animate-spin" />}
          </CardTitle>

          <div className="flex flex-col items-center gap-x-2 gap-y-2 lg:flex-row">
            <Button size="sm" onClick={onCancel} disabled={isImporting} className="w-full lg:w-auto">
              Cancel
            </Button>

            <Button
              size="sm"
              disabled={progress < requiredOptions.length || isImporting}
              onClick={handleContinue}
              className="w-full lg:w-auto"
            >
              {isImporting ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                `Continue (${progress}/${requiredOptions.length})`
              )}
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          <div className={isImporting ? "opacity-50 pointer-events-none" : ""}>
            <ImportTable
              headers={headers}
              body={body}
              selectedColumns={selectedColumns}
              onTableHeadSelectChange={onTableHeadSelectChange}
              options={options}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};