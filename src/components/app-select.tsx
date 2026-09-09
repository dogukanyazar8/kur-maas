"use client";

import * as Select from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import type { ReactNode } from "react";

type Option = { value: string; label: string; badge?: string };

export function AppSelect({
  id,
  label,
  value,
  onValueChange,
  options,
  icon,
  compact = false,
  disabled,
}: {
  id?: string;
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: Option[];
  icon?: ReactNode;
  compact?: boolean;
  disabled?: boolean;
}) {
  return (
    <Select.Root
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
    >
      <Select.Trigger
        id={id}
        aria-label={label}
        className={`app-select ${compact ? "app-select-compact" : ""}`}
      >
        {icon && (
          <span className="select-leading" aria-hidden="true">
            {icon}
          </span>
        )}
        <Select.Value />
        <Select.Icon className="select-chevron">
          <ChevronDown size={14} aria-hidden="true" />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content
          aria-label={label}
          className="select-menu"
          position="popper"
          sideOffset={7}
          collisionPadding={12}
        >
          <Select.ScrollUpButton className="select-scroll">
            <ChevronUp size={15} aria-hidden="true" />
          </Select.ScrollUpButton>
          <Select.Viewport className="select-viewport">
            {options.map((option) => (
              <Select.Item
                className="select-option"
                key={option.value}
                value={option.value}
                textValue={option.label}
              >
                <Select.ItemText>{option.label}</Select.ItemText>
                {option.badge && (
                  <span className="select-option-badge" aria-hidden="true">
                    {option.badge}
                  </span>
                )}
                <span className="select-check">
                  <Select.ItemIndicator>
                    <Check size={14} aria-hidden="true" />
                  </Select.ItemIndicator>
                </span>
              </Select.Item>
            ))}
          </Select.Viewport>
          <Select.ScrollDownButton className="select-scroll">
            <ChevronDown size={15} aria-hidden="true" />
          </Select.ScrollDownButton>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
