'use client';

import { useMemo } from 'react';
import type { MultiValue } from 'react-select';
import CreatableSelect from 'react-select/creatable';

type TagOption = {
    label: string;
    value: string;
    color?: string | null;
    suggested?: boolean;
};

type TagMultiSelectProps = {
    onChange: (values: string[]) => void;
    onCreate?: (value: string) => void;
    options?: TagOption[];
    value?: string[];
    disabled?: boolean;
    placeholder?: string;
    onMenuOpen?: () => void;
    onMenuClose?: () => void;
};

export const TagMultiSelect = ({
    value = [],
    onChange,
    onCreate,
    options = [],
    disabled,
    placeholder,
    onMenuOpen,
    onMenuClose,
}: TagMultiSelectProps) => {
    const onSelect = (selectedOptions: MultiValue<TagOption>) => {
        onChange(selectedOptions.map((option) => option.value));
    };

    const formattedValue = useMemo(() => {
        return options.filter((option) => value.includes(option.value));
    }, [options, value]);

    return (
        <CreatableSelect
            isMulti
            placeholder={placeholder}
            className="text-sm"
            styles={{
                control: (base) => ({
                    ...base,
                    borderColor: '#e2e8f0',
                    minHeight: '40px',
                    ':hover': {
                        borderColor: '#e2e8f0',
                    },
                }),
                multiValue: (base, { data }) => ({
                    ...base,
                    backgroundColor: data.color ? `${data.color}20` : '#dbeafe',
                    borderColor: data.color ?? '#3b82f6',
                    border: '1px solid',
                }),
                multiValueLabel: (base, { data }) => ({
                    ...base,
                    color: data.color ?? '#1e40af',
                    fontWeight: 500,
                }),
                multiValueRemove: (base, { data }) => ({
                    ...base,
                    color: data.color ?? '#1e40af',
                    ':hover': {
                        backgroundColor: data.color
                            ? `${data.color}40`
                            : '#bfdbfe',
                        color: data.color ?? '#1e3a8a',
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
                if (context !== 'menu') {
                    return option.label;
                }

                return (
                    <div className="flex items-center justify-between w-full gap-2">
                        <div className="flex items-center gap-2">
                            {option.color && (
                                <div
                                    className="w-3 h-3 rounded-full"
                                    style={{ backgroundColor: option.color }}
                                />
                            )}
                            <span>{option.label}</span>
                        </div>
                        {option.suggested && (
                            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                                Suggested
                            </span>
                        )}
                    </div>
                );
            }}
        />
    );
};
