import { motion } from "framer-motion";

export function MorphingBackground() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
      <div className="absolute inset-0 bg-background" />
      
      {/* Primary Blob */}
      <motion.div
        className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] bg-primary/20 blur-[100px] rounded-full mix-blend-screen"
        animate={{
          x: [0, 100, 0],
          y: [0, 50, 0],
          scale: [1, 1.2, 1],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
      
      {/* Secondary Blob */}
      <motion.div
        className="absolute bottom-[-10%] right-[-10%] w-[40vw] h-[40vw] bg-purple-600/20 blur-[120px] rounded-full mix-blend-screen"
        animate={{
          x: [0, -100, 0],
          y: [0, -50, 0],
          scale: [1, 1.3, 1],
        }}
        transition={{
          duration: 25,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
      
      {/* Accent Blob - Center */}
      <motion.div
        className="absolute top-[30%] left-[30%] w-[30vw] h-[30vw] bg-indigo-500/10 blur-[80px] rounded-full mix-blend-screen"
        animate={{
          opacity: [0.3, 0.6, 0.3],
          scale: [1, 1.1, 1],
        }}
        transition={{
          duration: 15,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
    </div>
  );
}
