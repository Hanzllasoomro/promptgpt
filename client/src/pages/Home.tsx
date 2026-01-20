import { useState } from "react";
import { useGeneratePrompt, usePrompts } from "@/hooks/use-prompts";
import { MorphingBackground } from "@/components/MorphingBackground";
import { PromptCard } from "@/components/PromptCard";
import { ThinkingAnimation } from "@/components/ThinkingAnimation";
import { Wand2, History, Plus, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function Home() {
  const [idea, setIdea] = useState("");
  const [selectedPromptId, setSelectedPromptId] = useState<number | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  
  const generateMutation = useGeneratePrompt();
  const { data: prompts, isLoading: isLoadingHistory } = usePrompts();

  // If we just generated a prompt, select it automatically
  const handleGenerate = async () => {
    if (!idea.trim()) return;
    
    try {
      const result = await generateMutation.mutateAsync({ idea });
      setSelectedPromptId(result.id);
      setIdea(""); // clear input
    } catch (error) {
      console.error(error);
    }
  };

  const currentPrompt = selectedPromptId 
    ? prompts?.find(p => p.id === selectedPromptId) 
    : null;

  const handleNew = () => {
    setSelectedPromptId(null);
    setIdea("");
  };

  return (
    <div className="min-h-screen text-foreground relative flex flex-col md:flex-row overflow-hidden">
      <MorphingBackground />

      {/* Sidebar - History (Desktop: Persistent, Mobile: Toggle) */}
      <aside 
        className={`
          fixed md:relative inset-y-0 left-0 z-40 w-full md:w-80 bg-black/80 backdrop-blur-xl border-r border-white/10
          transform transition-transform duration-300 ease-in-out md:translate-x-0
          ${showHistory ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="h-full flex flex-col p-4">
          <div className="flex items-center justify-between mb-6 px-2">
            <h2 className="text-xl font-display font-bold text-white flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white" />
              </span>
              PromptGPT
            </h2>
            <button 
              onClick={() => setShowHistory(false)}
              className="md:hidden p-2 text-muted-foreground hover:text-white"
            >
              Close
            </button>
          </div>

          <button
            onClick={handleNew}
            className="
              w-full mb-6 flex items-center justify-center gap-2 px-4 py-3 rounded-xl
              bg-white/10 border border-white/5 text-white font-medium
              hover:bg-white/20 hover:border-white/20 hover:shadow-lg
              transition-all duration-200 group
            "
          >
            <Plus className="w-4 h-4 group-hover:scale-110 transition-transform" />
            New Prompt
          </button>

          <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 px-1 pb-4">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-2">
              History
            </h3>
            {isLoadingHistory ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-20 bg-white/5 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : prompts?.length === 0 ? (
              <div className="text-center py-10 px-4">
                <p className="text-sm text-muted-foreground">No prompts generated yet.</p>
              </div>
            ) : (
              prompts?.map(prompt => (
                <PromptCard 
                  key={prompt.id} 
                  prompt={prompt} 
                  compact 
                  onClick={() => {
                    setSelectedPromptId(prompt.id);
                    setShowHistory(false);
                  }}
                />
              ))
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        {/* Mobile Header */}
        <header className="md:hidden flex items-center justify-between p-4 border-b border-white/10 bg-black/40 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </span>
            <span className="font-display font-bold">PromptGPT</span>
          </div>
          <button 
            onClick={() => setShowHistory(true)}
            className="p-2 text-white bg-white/10 rounded-lg"
          >
            <History className="w-5 h-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8 lg:p-12">
          <div className="max-w-4xl mx-auto space-y-12">
            
            <AnimatePresence mode="wait">
              {/* Generation Form */}
              {!currentPrompt && !generateMutation.isPending && (
                <motion.div
                  key="form"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="flex flex-col items-center justify-center min-h-[60vh]"
                >
                  <div className="text-center mb-10 max-w-2xl">
                    <h1 className="text-4xl md:text-5xl font-display font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-white/50">
                      Transform Ideas into Magic
                    </h1>
                    <p className="text-lg text-muted-foreground">
                      Enter a simple idea, and our AI will craft the perfect, detailed prompt optimized for LLMs.
                    </p>
                  </div>

                  <div className="w-full max-w-2xl relative group">
                    <div className="absolute -inset-1 bg-gradient-to-r from-primary to-purple-600 rounded-2xl opacity-20 group-hover:opacity-40 blur transition duration-500" />
                    <div className="relative bg-black rounded-xl p-2 border border-white/10 shadow-2xl">
                      <textarea
                        value={idea}
                        onChange={(e) => setIdea(e.target.value)}
                        placeholder="e.g., Explain quantum physics to a 5-year-old using emojis..."
                        className="
                          w-full min-h-[120px] bg-transparent text-lg p-4
                          placeholder:text-muted-foreground/50 text-white
                          resize-none focus:outline-none rounded-lg
                        "
                      />
                      <div className="flex justify-between items-center px-2 pb-2 mt-2 border-t border-white/5 pt-3">
                        <span className="text-xs text-muted-foreground">
                          {idea.length} characters
                        </span>
                        <button
                          onClick={handleGenerate}
                          disabled={!idea.trim() || generateMutation.isPending}
                          className="
                            flex items-center gap-2 px-6 py-2.5 rounded-lg font-semibold
                            bg-gradient-to-r from-primary to-purple-600 text-white
                            shadow-lg shadow-primary/25
                            hover:shadow-xl hover:shadow-primary/40 hover:-translate-y-0.5
                            disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0
                            transition-all duration-200 ease-out
                          "
                        >
                          <Wand2 className="w-4 h-4" />
                          Generate Magic Prompt
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="w-full max-w-2xl mt-8 flex flex-wrap justify-center gap-2">
                    {[
                      { label: "Portfolio Website", value: "A modern personal portfolio website for a creative designer" },
                      { label: "YouTube Video SEO", value: "Optimize a YouTube video about healthy cooking for search results" },
                      { label: "Explain Quantum Physics", value: "Explain Quantum Physics to a 5-year-old using emojis and simple analogies" }
                    ].map((suggestion) => (
                      <button
                        key={suggestion.label}
                        onClick={() => setIdea(suggestion.value)}
                        className="
                          px-3 py-1.5 rounded-full text-xs font-medium
                          bg-white/5 border border-white/10 text-muted-foreground
                          hover:bg-white/10 hover:text-white hover:border-white/20
                          transition-all duration-200
                        "
                      >
                        {suggestion.label}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Loading State */}
              {generateMutation.isPending && (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center justify-center min-h-[60vh]"
                >
                  <ThinkingAnimation />
                </motion.div>
              )}

              {/* Result State */}
              {currentPrompt && !generateMutation.isPending && (
                <motion.div
                  key="result"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="w-full space-y-8"
                >
                  <div className="flex items-center justify-between">
                    <button
                      onClick={handleNew}
                      className="text-sm text-muted-foreground hover:text-white flex items-center gap-2 transition-colors"
                    >
                      ← Create another
                    </button>
                  </div>
                  
                  <PromptCard prompt={currentPrompt} />
                  
                  <div className="text-center pt-8">
                     <p className="text-muted-foreground text-sm">
                       Tip: Copy this prompt and paste it directly into ChatGPT, Claude, or Gemini.
                     </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

          </div>
        </div>
      </main>
    </div>
  );
}
