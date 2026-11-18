"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function ChoiceMenu({
  title,
  label,
  choices,
}: {
  title: string;
  label: string;
  choices: { label: string; href: string; isChosen: boolean }[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const chosen = choices.find((choice) => choice.isChosen);
  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm">
          {title}: {chosen?.label} <ChevronDown aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-1">
        <nav aria-label={label} className="flex flex-col gap-0.5">
          {choices.map((choice) => (
            <Button
              key={choice.href}
              asChild
              variant={choice.isChosen ? "soft" : "ghost"}
              className="justify-start"
            >
              <Link
                href={choice.href}
                aria-current={choice.isChosen ? "true" : undefined}
                onClick={() => setIsOpen(false)}
              >
                <Check aria-hidden className={choice.isChosen ? undefined : "invisible"} />
                {choice.label}
              </Link>
            </Button>
          ))}
        </nav>
      </PopoverContent>
    </Popover>
  );
}
