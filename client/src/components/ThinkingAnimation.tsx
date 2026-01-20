import { motion } from "framer-motion";

export function ThinkingAnimation() {
  return (
    <div className="flex flex-col items-center justify-center py-20 space-y-8">
      <div className="relative w-32 h-32">
        {/* Core pulse */}
        <motion.div
          className="absolute inset-0 bg-primary rounded-full opacity-20"
          animate={{
            scale: [1, 2, 1],
            opacity: [0.2, 0.5, 0.2],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
        
        {/* Orbiting particles */}
        {[...Array(3)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute inset-0 border-2 border-transparent border-t-primary rounded-full"
            style={{ rotate: i * 45 }}
            animate={{ rotate: 360 + i * 45 }}
            transition={{
              duration: 3 + i,
              repeat: Infinity,
              ease: "linear",
            }}
          />
        ))}

        {/* Center icon wrapper */}
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div 
            className="w-16 h-16 bg-gradient-to-tr from-primary to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-primary/40"
            animate={{
              rotate: [0, 10, -10, 0],
              borderRadius: ["30%", "40%", "30%"],
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          >
            <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin" />
          </motion.div>
        </div>
      </div>
      
      <div className="space-y-2 text-center">
        <h3 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">
          Refining your idea...
        </h3>
        <p className="text-muted-foreground text-sm max-w-xs mx-auto">
          Applying prompt engineering best practices to maximize output quality.
        </p>
      </div>
    </div>
  );
}
