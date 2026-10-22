import type { ReactNode } from 'react';
import { motion } from 'motion/react';

// A finished step leaves upward while the next one grows in from slightly smaller.
export function Scene({ children }: { children: ReactNode }) {
  return (
    <motion.section
      className="scene"
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, y: -56 }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
    >
      {children}
    </motion.section>
  );
}

export function Fade({ children }: { children: ReactNode }) {
  return (
    <motion.div
      className="fade"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      {children}
    </motion.div>
  );
}
