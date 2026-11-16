"use client";

import {
  Children,
  createContext,
  isValidElement,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { ArrowLeftIcon, ArrowRightIcon } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Stream } from "@/components/neon/stream";

type PanelSlot = { index: number; currentIndex: number };

const PanelSlotContext = createContext<PanelSlot>({ index: 0, currentIndex: 0 });

export function Panel({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  const { index, currentIndex } = useContext(PanelSlotContext);
  return (
    <section
      aria-label={title}
      className={cn("panel", index === currentIndex && "is-current", className)}
    >
      {children}
    </section>
  );
}

function overflows(element: Element) {
  return (
    element.scrollHeight > element.clientHeight + 1 || element.scrollWidth > element.clientWidth + 1
  );
}

function fitPanels(rootElement: HTMLElement) {
  const bodyElement = rootElement.querySelector<HTMLElement>(".panels__body");
  rootElement.dataset.mode = "spread";
  if (!bodyElement) return;
  const panelElements = [...rootElement.querySelectorAll(".panel")];
  if (panelElements.length < 2) return;
  if (overflows(bodyElement) || panelElements.some(overflows)) rootElement.dataset.mode = "paged";
}

export function Panels({ children, className }: { children: ReactNode; className?: string }) {
  const [requestedIndex, setRequestedIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelElements = Children.toArray(children).filter(
    (child): child is ReactElement<{ title: string }> => isValidElement(child),
  );
  const lastIndex = Math.max(panelElements.length - 1, 0);
  const currentIndex = Math.min(requestedIndex, lastIndex);
  const titles = panelElements.map((element) => element.props.title);

  useLayoutEffect(() => {
    if (rootRef.current) fitPanels(rootRef.current);
  });

  useEffect(() => {
    const rootElement = rootRef.current;
    if (!rootElement) return;
    const observer = new ResizeObserver(() => fitPanels(rootElement));
    observer.observe(rootElement);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={rootRef} className={cn("panels", className)}>
      <div className="panels__body">
        {panelElements.map((element, index) => (
          <PanelSlotContext.Provider key={index} value={{ index, currentIndex }}>
            {element}
          </PanelSlotContext.Provider>
        ))}
      </div>
      {panelElements.length > 1 ? (
        <nav aria-label="Sections on this screen" className="panels__pager">
          <Button
            variant="soft"
            size="icon"
            aria-label="Previous section"
            disabled={currentIndex === 0}
            focusableWhenDisabled
            onClick={() => setRequestedIndex(currentIndex - 1)}
          >
            <ArrowLeftIcon aria-hidden="true" />
          </Button>
          <Stream
            steps={titles.map((label) => ({ label }))}
            current={currentIndex}
            variant="small"
            label="Screen progress"
          />
          <span className="panels__pager-label" aria-live="polite">
            {`${currentIndex + 1}/${panelElements.length} · ${titles[currentIndex]}`}
          </span>
          <Button
            variant="soft"
            size="icon"
            aria-label="Next section"
            disabled={currentIndex === lastIndex}
            focusableWhenDisabled
            onClick={() => setRequestedIndex(currentIndex + 1)}
          >
            <ArrowRightIcon aria-hidden="true" />
          </Button>
        </nav>
      ) : null}
    </div>
  );
}
