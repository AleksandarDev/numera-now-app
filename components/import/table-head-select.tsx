import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type TableHeadSelectProps = {
  options: string[];
  columnIndex: number;
  selectedColumns: Record<string, string | null>;
  onChange: (columnIndex: number, value: string | null) => void;
};

export const TableHeadSelect = ({
  options,
  columnIndex,
  selectedColumns,
  onChange,
}: TableHeadSelectProps) => {
  const currentSelection = selectedColumns[`column_${columnIndex}`];

  return (
    <Select
      value={currentSelection || ""}
      onValueChange={(value) => onChange(columnIndex, value)}
    >
      <SelectTrigger
        className={cn(
          "border-none bg-transparent capitalize outline-none focus:ring-transparent focus:ring-offset-0",
          currentSelection && "font-bold text-black"
        )}
      >
        <SelectValue placeholder="Skip" />
      </SelectTrigger>

      <SelectContent>
        <SelectItem value="skip">Skip</SelectItem>
        {options.map((option, index) => {
          // Allow multiple columns to map to the same property
          return (
            <SelectItem
              key={index}
              value={option}
              className="capitalize"
            >
              {option}
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
};