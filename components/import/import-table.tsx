import { Table } from '@signalco/ui-primitives/Table';
import { TableHeadSelect } from '@/components/import/table-head-select';

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
                <Table.Header className="bg-muted">
                    <Table.Row>
                        {headers.map((header, index) => (
                            <Table.Head key={`header-${index}-${header}`}>
                                <TableHeadSelect
                                    options={options}
                                    columnIndex={index}
                                    selectedColumns={selectedColumns}
                                    onChange={onTableHeadSelectChange}
                                />
                            </Table.Head>
                        ))}
                    </Table.Row>
                </Table.Header>

                <Table.Body>
                    {body.map((row: string[], rowIndex) => (
                        <Table.Row
                            key={`row-${rowIndex}-${row.join('-').slice(0, 50)}`}
                        >
                            {row.map((cell, cellIndex) => (
                                <Table.Cell
                                    key={`cell-${rowIndex}-${cellIndex}-${cell?.slice(0, 20) ?? ''}`}
                                >
                                    {cell}
                                </Table.Cell>
                            ))}
                        </Table.Row>
                    ))}
                </Table.Body>
            </Table>
        </div>
    );
};
