"use client";

import { format, subDays, addDays, startOfWeek, startOfMonth, startOfYear } from "date-fns";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import qs from "query-string";
import { useState } from "react";
import { type DateRange } from "react-day-picker";
import { Stack } from "@signalco/ui-primitives/Stack";
import { Row } from "@signalco/ui-primitives/Row";
import { IconButton } from "@signalco/ui-primitives/IconButton";
import { Button } from "@signalco/ui-primitives/Button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { formatDateRange } from "@/lib/utils";

export const DateFilter = () => {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const accountId = searchParams.get("accountId");
  const from = searchParams.get("from") || "";
  const to = searchParams.get("to") || "";

  const defaultTo = new Date();
  const defaultFrom = subDays(defaultTo, 30);

  const paramState = {
    from: from ? new Date(from) : defaultFrom,
    to: to ? new Date(to) : defaultTo,
  };

  const [date, setDate] = useState<DateRange | undefined>(paramState);

  const pushToUrl = (dateRange: DateRange | undefined) => {
    const query = {
      from: format(dateRange?.from || defaultFrom, "yyyy-MM-dd"),
      to: format(dateRange?.to || defaultTo, "yyyy-MM-dd"),
      accountId,
    };

    const url = qs.stringifyUrl(
      {
        url: pathname,
        query,
      },
      { skipEmptyString: true, skipNull: true }
    );

    router.push(url);
  };

  const onReset = () => {
    setDate(undefined);
    pushToUrl(undefined);
  };

  const handleDateRangeClick = (range: string) => {
    let newFrom = defaultFrom;
    let newTo = defaultTo;

    switch (range) {
      case "Today":
        newFrom = newTo = new Date();
        break;
      case "Yesterday":
        newFrom = newTo = subDays(new Date(), 1);
        break;
      case "This week":
        newFrom = startOfWeek(new Date(), { weekStartsOn: 1 });
        newTo = new Date();
        break;
      case "Last 7 days":
        newFrom = subDays(new Date(), 7);
        newTo = new Date();
        break;
      case "This month":
        newFrom = startOfMonth(new Date());
        newTo = new Date();
        break;
      case "Last 30 days":
        newFrom = subDays(new Date(), 30);
        newTo = new Date();
        break;
      case "This year":
        newFrom = startOfYear(new Date());
        newTo = new Date();
        break;
      case "Last 365 days":
        newFrom = subDays(new Date(), 365);
        newTo = new Date();
        break;
      default:
        break;
    }

    const newDateRange = { from: newFrom, to: newTo };
    setDate(newDateRange);
    pushToUrl(newDateRange);
  };

  const handleNextDateRangeClick = () => {
    if (!date) return;

    const { from, to } = date;
    const diff = (to?.getTime() || 0) - (from?.getTime() || 0);

    const newFrom = addDays(to || new Date(), 1);
    const newTo = addDays(newFrom, diff / (1000 * 60 * 60 * 24));

    const newDateRange = { from: newFrom, to: newTo };
    setDate(newDateRange);
    pushToUrl(newDateRange);
  };

  const handlePreviousDateRangeClick = () => {
    if (!date) return;

    const { from, to } = date;
    const diff = (to?.getTime() || 0) - (from?.getTime() || 0);

    const newTo = subDays(from || new Date(), 1);
    const newFrom = subDays(newTo, diff / (1000 * 60 * 60 * 24));

    const newDateRange = { from: newFrom, to: newTo };
    setDate(newDateRange);
    pushToUrl(newDateRange);
  };

  return (
    <Row className="dark">
      <IconButton title="Previous date range" onClick={handlePreviousDateRangeClick} className="w-6 px-0 rounded-r-none">
        <ChevronLeft className="size-4" />
      </IconButton>
    <Popover>
      <PopoverTrigger asChild>
        <Button
          disabled={false}
          size="sm"
            variant="outlined"
            className="h-9 w-full rounded-none border-none bg-white/10 px-3 font-normal text-white outline-none transition hover:bg-white/30 hover:text-white focus:bg-white/30 focus:ring-transparent focus:ring-offset-0 lg:w-auto"
        >
          <span>{formatDateRange(paramState)}</span>

          <ChevronDown className="ml-2 size-4 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-full p-0 lg:w-auto" align="start">
          <div className="grid grid-cols-[auto,1fr]">
            <Stack spacing={1} className="p-2">
              <Button variant="outlined" onClick={() => handleDateRangeClick("Today")}>
                Today
              </Button>
              <Button variant="outlined" onClick={() => handleDateRangeClick("Yesterday")}>
                Yesterday
              </Button>
              <Button variant="outlined" onClick={() => handleDateRangeClick("This week")}>
                This week
              </Button>
              <Button variant="outlined" onClick={() => handleDateRangeClick("Last 7 days")}>
                Last 7 days
              </Button>
              <Button variant="outlined" onClick={() => handleDateRangeClick("This month")}>
                This month
              </Button>
              <Button variant="outlined" onClick={() => handleDateRangeClick("Last 30 days")}>
                Last 30 days
              </Button>
              <Button variant="outlined" onClick={() => handleDateRangeClick("This year")}>
                This year
              </Button>
              <Button variant="outlined" onClick={() => handleDateRangeClick("Last 365 days")}>
                Last 365 days
              </Button>
            </Stack>
            <Stack>
              <Calendar
                disabled={false}
                initialFocus
                mode="range"
                defaultMonth={date?.from}
                selected={date}
                onSelect={setDate}
                numberOfMonths={2}
              />

              <div className="flex w-full items-center gap-x-2 p-4">
                <PopoverClose asChild>
                  <Button
                    onClick={onReset}
                    disabled={!date?.from || !date?.to}
                    className="w-full"
                    variant="outlined"
                  >
                    Reset
                  </Button>
                </PopoverClose>

                <PopoverClose asChild>
                  <Button
                    onClick={() => pushToUrl(date)}
                    disabled={!date?.from || !date?.to}
                    className="w-full"
                    variant="solid"
                  >
                    Apply
                  </Button>
                </PopoverClose>
              </div>
            </Stack>
        </div>
      </PopoverContent>
    </Popover>
      <IconButton title="Next date range" onClick={handleNextDateRangeClick} className="w-6 px-0 rounded-l-none">
        <ChevronRight className="size-4" />
      </IconButton>
    </Row>
  );
};