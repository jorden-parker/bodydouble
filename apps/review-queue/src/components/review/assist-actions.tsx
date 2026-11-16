import {
  BookOpen,
  ClipboardCheck,
  MessageCircleQuestion,
  MessageSquareText,
  Wand2,
} from "lucide-react";
import type { AssistAction } from "@/lib/assist-protocol";

type AssistActionButton = {
  action: AssistAction;
  label: string;
  icon: React.ReactNode;
};

export const ASSIST_ACTION_BUTTONS: AssistActionButton[] = [
  { action: "explain", label: "Explain", icon: <BookOpen /> },
  { action: "simplify", label: "Simplify", icon: <Wand2 /> },
  { action: "comment", label: "Comment", icon: <MessageSquareText /> },
];

export const FILE_ACTION_BUTTONS: AssistActionButton[] = [
  ...ASSIST_ACTION_BUTTONS,
  { action: "ask", label: "Ask", icon: <MessageCircleQuestion /> },
  { action: "review", label: "Review", icon: <ClipboardCheck /> },
];
