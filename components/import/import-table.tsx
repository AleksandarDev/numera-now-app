import { TableHeadSelect } from '@/components/import/table-head-select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';

type ImportTableProps = {
    headers: string[];
    body: string[][];
    selectedColumns: Record<string, string | null>;
    onTableHeadSelectChange: (
        columnIndex: number,
        value: string | null,
    ) => void;
    options: string[];
};

export const ImportTable = ({
    headers,
    body,
    onTableHeadSelectChange,
    selectedColumns,
    options,
}: ImportTableProps) => {
    return (
        <div className="overflow-hidden rounded-md border">
            <Table>
                <TableHeader className="bg-muted">
                    <TableRow>
                        {headers.map((header, index) => (
                            <TableHead key={`header-${index}-${header}`}>
                                <TableHeadSelect
                                    options={options}
                                    columnIndex={index}
                                    selectedColumns={selectedColumns}
                                    onChange={onTableHeadSelectChange}
                                />
                            </TableHead>
                        ))}
                    </TableRow>
                </TableHeader>

                <TableBody>
                    {body.map((row: string[], rowIndex) => (
                        <TableRow
                            key={`row-${rowIndex}-${row.join('-').slice(0, 50)}`}
                        >
                            {row.map((cell, cellIndex) => (
                                <TableCell
                                    key={`cell-${rowIndex}-${cellIndex}-${cell?.slice(0, 20) ?? ''}`}
                                >
                                    {cell}
                                </TableCell>
                            ))}
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
};
