"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import {
  Children,
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Stream } from "./stream";

type PanelProps = {
  title: string;
  children: ReactNode;
  className?: string;
};

const PanelContext = createContext({ isCurrent: false });

export function Panel({ title, children, className }: PanelProps) {
  const { isCurrent } = useContext(PanelContext);
  return (
    <section aria-label={title} className={cn("panel", isCurrent && "is-current", className)}>
      {children}
    </section>
  );
}

type PanelsProps = {
  label: string;
  children: ReactNode;
  className?: string;
};

export function Panels({ label, children, className }: PanelsProps) {
  const panels = Children.toArray(children).filter((child): child is ReactElement<PanelProps> =>
    isValidElement(child),
  );
  const titles = panels.map((panel) => panel.props.title);
  const lastIndex = Math.max(titles.length - 1, 0);
  const [requestedIndex, setRequestedIndex] = useState(0);
  const [isPaged, setIsPaged] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const shownIndex = Math.min(requestedIndex, lastIndex);

  const measure = useCallback(() => {
    const root = rootRef.current;
    const main = mainRef.current;
    if (!root || !main) {
      return;
    }
    root.dataset.mode = "spread";
    const overflows =
      main.scrollHeight > main.clientHeight + 1 || main.scrollWidth > main.clientWidth + 1;
    root.dataset.mode = overflows ? "paged" : "spread";
    setIsPaged(overflows);
  }, []);

  useLayoutEffect(() => {
    const main = mainRef.current;
    measure();
    if (!main) {
      return;
    }
    const observer = new ResizeObserver(measure);
    observer.observe(main);
    Array.from(main.children).forEach((child) => observer.observe(child));
    return () => observer.disconnect();
  }, [measure, titles.length]);

  const goTo = (index: number) => setRequestedIndex(Math.max(0, Math.min(lastIndex, index)));

  return (
    <div ref={rootRef} className="screen">
      <main id="main" ref={mainRef} className={cn("app-main", className)}>
        {panels.map((panel, index) => (
          <PanelContext.Provider
            key={panel.key ?? index}
            value={{ isCurrent: index === shownIndex }}
          >
            {panel}
          </PanelContext.Provider>
        ))}
      </main>
      {isPaged && titles.length > 1 && (
        <nav aria-label={label} className="app-pager">
          <Button
            variant="soft"
            size="icon"
            aria-label="Previous section"
            disabled={shownIndex === 0}
            onClick={() => goTo(shownIndex - 1)}
          >
            <ArrowLeft aria-hidden="true" />
          </Button>
          <Stream
            steps={titles.map((title) => ({ label: title }))}
            currentIndex={shownIndex}
            label={label}
            variant="small"
          />
          <span className="app-pager__label" aria-live="polite">
            {`${shownIndex + 1}/${titles.length} · ${titles[shownIndex]}`}
          </span>
          <Button
            variant="soft"
            size="icon"
            aria-label="Next section"
            disabled={shownIndex === lastIndex}
            onClick={() => goTo(shownIndex + 1)}
          >
            <ArrowRight aria-hidden="true" />
          </Button>
        </nav>
      )}
    </div>
  );
}
