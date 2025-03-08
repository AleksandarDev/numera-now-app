import { Import } from "lucide-react";
import { useCSVReader } from "react-papaparse";

import { Button } from "@/components/ui/button";

type ImportButtonProps = {
  onUpload: (results: any) => void;
};

export const ImportButton = ({ onUpload }: ImportButtonProps) => {
  const { CSVReader } = useCSVReader();

  return (
    <CSVReader onUploadAccepted={onUpload}>
      {({ getRootProps }: any) => (
        <Button size="sm" className="w-full lg:w-auto" {...getRootProps()}>
          <Import className="mr-2 size-4" />
          Import
        </Button>
      )}
    </CSVReader>
  );
};