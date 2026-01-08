'use client';

import { useMemo } from 'react';
import type { SingleValue } from 'react-select';
import CreatableSelect from 'react-select/creatable';

type SelectOption = {
    label: string;
    value: string;
    suggested?: boolean;
};

type SelectProps = {
    onChange: (value?: string) => void;
    onCreate?: (value: string) => void;
    options?: SelectOption[];
    value?: string | null | undefined;
    disabled?: boolean;
    placeholder?: string;
    onMenuOpen?: () => void;
    onMenuClose?: () => void;
};

export const Select = ({
    value,
    onChange,
    onCreate,
    options = [],
    disabled,
    placeholder,
    onMenuOpen,
    onMenuClose,
}: SelectProps) => {
    const onSelect = (option: SingleValue<SelectOption>) => {
        onChange(option?.value);
    };

    const formattedValue = useMemo(() => {
        return options.find((option) => option.value === value);
    }, [options, value]);

    return (
        <CreatableSelect
            placeholder={placeholder}
            className="h-10 text-sm"
            styles={{
                control: (base) => ({
                    ...base,
                    borderColor: '#e2e8f0',
                    ':hover': {
                        borderColor: '#e2e8f0',
                    },
                }),
            }}
            value={formattedValue}
            onChange={onSelect}
            options={options}
            onCreateOption={onCreate}
            isDisabled={disabled}
            onMenuOpen={onMenuOpen}
            onMenuClose={onMenuClose}
            formatOptionLabel={(option, { context }) => {
                if (context !== 'menu' || !option.suggested) {
                    return option.label;
                }

                return (
                    <div className="flex items-center justify-between w-full gap-2">
                        <span>{option.label}</span>
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                            Suggested
                        </span>
                    </div>
                );
            }}
        />
    );
};
