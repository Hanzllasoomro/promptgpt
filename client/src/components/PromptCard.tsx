import { motion } from "framer-motion";
import { Copy, Sparkles, Check } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useState } from "react";
import { GeneratedPrompt } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";

interface PromptCardProps {
  prompt: GeneratedPrompt;
  onClick?: () => void;
  compact?: boolean;
}

export function PromptCard({ prompt, onClick, compact = false }: PromptCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(prompt.magicPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (compact) {
    return (
      <motion.div
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={onClick}
        className="
          group relative p-4 rounded-xl cursor-pointer
          bg-white/5 border border-white/10
          hover:bg-white/10 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/20
          transition-all duration-300
        "
      >
        <div className="flex items-start justify-between">
          <h4 className="text-base font-medium text-foreground line-clamp-1">
            {prompt.originalIdea}
          </h4>
          <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
            {prompt.createdAt ? formatDistanceToNow(new Date(prompt.createdAt), { addSuffix: true }) : 'Just now'}
          </span>
        </div>
        <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-black/20 to-transparent rounded-b-xl" />
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-2xl bg-black/40 border border-white/10 backdrop-blur-xl shadow-2xl"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-white/5 bg-white/5">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/20 text-primary">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Generated Magic Prompt</h3>
          </div>
        </div>
        
        <button
          onClick={handleCopy}
          className="
            flex items-center gap-2 px-4 py-2 rounded-lg
            bg-primary text-primary-foreground font-medium
            hover:bg-primary/90 transition-colors
            focus:outline-none focus:ring-2 focus:ring-primary/50
          "
        >
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          {copied ? "Copied!" : "Copy Prompt"}
        </button>
      </div>

      {/* Content */}
      <div className="p-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
        <div className="prose prose-invert max-w-none markdown-preview">
          <ReactMarkdown>{prompt.magicPrompt}</ReactMarkdown>
        </div>
      </div>

      {/* Footer */}
      <div className="px-6 py-4 bg-black/20 border-t border-white/5 text-xs text-muted-foreground flex justify-between">
        <span>Original Idea: {prompt.originalIdea}</span>
        <span>{prompt.createdAt ? new Date(prompt.createdAt).toLocaleString() : 'Just now'}</span>
      </div>
    </motion.div>
  );
}
