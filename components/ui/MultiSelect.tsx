"use client";

import React, { useState, useMemo } from "react";
import { RiArrowDownSLine, RiCheckLine, RiCloseLine, RiSearchLine } from "@remixicon/react";
import { Popover, PopoverContent, PopoverTrigger } from "./Popover";
import { Badge } from "./Badge";
import { cx, focusInput } from "@/lib/utils";

export interface MultiSelectProps {
    options: string[];
    selected: string[];
    onChange: (selected: string[]) => void;
    placeholder?: string;
    searchPlaceholder?: string;
    emptyText?: string;
    className?: string;
}

export function MultiSelect({
    options,
    selected,
    onChange,
    placeholder = "Pilih...",
    searchPlaceholder = "Cari...",
    emptyText = "Tidak ada pilihan ditemukan.",
    className
}: MultiSelectProps) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");

    const filteredOptions = useMemo(() => {
        if (!search) return options;
        const lowerSearch = search.toLowerCase();
        return options.filter(o => o.toLowerCase().includes(lowerSearch));
    }, [options, search]);

    function toggleOption(option: string) {
        if (selected.includes(option)) {
            onChange(selected.filter((item) => item !== option));
        } else {
            onChange([...selected, option]);
        }
    }

    function clearAll(e: React.MouseEvent) {
        e.stopPropagation();
        onChange([]);
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    role="combobox"
                    aria-expanded={open}
                    aria-controls="mselect-options"
                    className={cx(
                        "flex min-h-9 w-full items-center justify-between gap-1 rounded-md border bg-white px-3 py-1.5 text-sm shadow-sm outline-none transition-colors",
                        "border-gray-300 dark:border-gray-800 dark:bg-gray-950",
                        "text-gray-900 dark:text-gray-50",
                        "hover:bg-gray-50 dark:hover:bg-gray-950/50",
                        "disabled:pointer-events-none disabled:opacity-50",
                        focusInput,
                        className
                    )}
                >
                    <div className="flex flex-wrap items-center gap-1 overflow-hidden">
                        {selected.length === 0 && (
                            <span className="text-gray-500 truncate">{placeholder}</span>
                        )}
                        {selected.length > 0 && selected.length <= 2 && selected.map((item) => (
                            <Badge key={item} variant="neutral" className="px-1.5 py-0.5 text-xs max-w-24 truncate">
                                {item}
                            </Badge>
                        ))}
                        {selected.length > 2 && (
                            <Badge variant="neutral" className="px-1.5 py-0.5 text-xs">
                                {selected.length} dipilih
                            </Badge>
                        )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1 group pl-1">
                        {selected.length > 0 && (
                            <div
                                role="button"
                                tabIndex={0}
                                onClick={clearAll}
                                className="p-0.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
                                title="Hapus semua"
                            >
                                <RiCloseLine className="size-3.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" />
                            </div>
                        )}
                        <RiArrowDownSLine className={cx("size-4 text-gray-400 transition-transform", open ? "rotate-180" : "")} aria-hidden="true" />
                    </div>
                </button>
            </PopoverTrigger>
            <PopoverContent id="mselect-options" className="w-[--radix-popover-trigger-width] min-w-[220px] p-0" align="start">
                <div className="flex items-center gap-2 border-b border-gray-100 px-3 py-2 dark:border-gray-800">
                    <RiSearchLine className="size-4 shrink-0 text-gray-400" />
                    <input
                        className="flex w-full rounded-md bg-transparent py-1 text-sm outline-none placeholder:text-gray-400 dark:placeholder:text-gray-500"
                        placeholder={searchPlaceholder}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                    {search && (
                        <button type="button" onClick={() => setSearch("")} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                            <RiCloseLine className="size-4" />
                        </button>
                    )}
                </div>
                <div className="max-h-60 overflow-y-auto p-1">
                    {filteredOptions.length === 0 ? (
                        <p className="py-6 text-center text-sm text-gray-500">{emptyText}</p>
                    ) : (
                        filteredOptions.map((option) => {
                            const isSelected = selected.includes(option);
                            return (
                                <div
                                    key={option}
                                    onClick={() => toggleOption(option)}
                                    className={cx(
                                        "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors",
                                        "hover:bg-gray-100 dark:hover:bg-gray-800",
                                        "text-gray-900 dark:text-gray-50"
                                    )}
                                >
                                    <div
                                        className={cx(
                                            "mr-2 flex size-4 shrink-0 items-center justify-center rounded border",
                                            isSelected
                                                ? "border-blue-600 bg-blue-600 text-white dark:border-blue-500 dark:bg-blue-500"
                                                : "border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-950"
                                        )}
                                    >
                                        {isSelected && <RiCheckLine className="size-3" />}
                                    </div>
                                    <span className="truncate">{option}</span>
                                </div>
                            );
                        })
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
}
