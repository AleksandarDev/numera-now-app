'use client';

import { useMemo, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    type Country,
    countryGroups,
    getCountryByCode,
    getCountryGroup,
} from '@/lib/countries';

type CountrySelectProps = {
    value?: string | null;
    onChange: (value: string) => void;
    disabled?: boolean;
    placeholder?: string;
    className?: string;
};

function CountryDisplay({ country }: { country: Country }) {
    const group = getCountryGroup(country.code);
    return (
        <span className="flex items-center gap-2">
            <span>{country.flag}</span>
            <span>{country.name}</span>
            {group?.flag && (
                <span className="text-xs opacity-60">{group.flag}</span>
            )}
        </span>
    );
}

export function CountrySelect({
    value,
    onChange,
    disabled,
    placeholder = 'Select country...',
    className,
}: CountrySelectProps) {
    const [search, setSearch] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    const filteredGroups = useMemo(() => {
        if (!search) return countryGroups;
        const lowerSearch = search.toLowerCase();
        return countryGroups
            .map((group) => ({
                ...group,
                countries: group.countries.filter(
                    (c) =>
                        c.name.toLowerCase().includes(lowerSearch) ||
                        c.code.toLowerCase().includes(lowerSearch),
                ),
            }))
            .filter((group) => group.countries.length > 0);
    }, [search]);

    const selectedCountry = value ? getCountryByCode(value) : undefined;

    return (
        <Select
            value={value ?? undefined}
            onValueChange={onChange}
            disabled={disabled}
        >
            <SelectTrigger className={className}>
                <SelectValue placeholder={placeholder}>
                    {selectedCountry && (
                        <CountryDisplay country={selectedCountry} />
                    )}
                </SelectValue>
            </SelectTrigger>
            <SelectContent
                startDecorator={
                    <div className="p-2 border-b">
                        <Input
                            ref={inputRef}
                            placeholder="Search countries..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            onKeyDown={(e) => e.stopPropagation()}
                            className="h-8"
                        />
                    </div>
                }
            >
                {filteredGroups.map((group) => (
                    <SelectGroup key={group.label}>
                        <SelectLabel className="flex items-center gap-2">
                            {group.flag && <span>{group.flag}</span>}
                            <span>{group.label}</span>
                        </SelectLabel>
                        {group.countries.map((country) => (
                            <SelectItem key={country.code} value={country.code}>
                                <span className="flex items-center gap-2">
                                    <span>{country.flag}</span>
                                    <span>{country.name}</span>
                                </span>
                            </SelectItem>
                        ))}
                    </SelectGroup>
                ))}
                {filteredGroups.length === 0 && (
                    <div className="py-6 text-center text-sm text-muted-foreground">
                        No countries found.
                    </div>
                )}
            </SelectContent>
        </Select>
    );
}
