import { Import } from "lucide-react";
import { useCSVReader } from "react-papaparse";

import { Button } from "@/components/ui/button";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type ImportButtonProps = {
  onUpload: (results: any) => void;
  variant?: "button" | "menu";
  className?: string;
};

export const ImportButton = ({ onUpload, variant = "button", className }: ImportButtonProps) => {
  const { CSVReader } = useCSVReader();

  if (variant === "menu") {
    return (
      <CSVReader onUploadAccepted={onUpload}>
        {({ getRootProps }: any) => (
          <DropdownMenuItem className={cn("gap-2 cursor-pointer", className)} {...getRootProps()}>
            <Import className="size-4" />
            Import
          </DropdownMenuItem>
        )}
      </CSVReader>
    );
  }

  return (
    <CSVReader onUploadAccepted={onUpload}>
      {({ getRootProps }: any) => (
        <Button size="sm" className={cn("w-full lg:w-auto", className)} {...getRootProps()}>
          <Import className="mr-2 size-4" />
          Import
        </Button>
      )}
    </CSVReader>
  );
};