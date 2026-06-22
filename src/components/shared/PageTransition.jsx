import { motion } from 'framer-motion';

export default function PageTransition({ children }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -16 }}
      transition={{ duration: 0.16, ease: 'easeInOut' }}
      style={{ display: 'contents' }}
    >
      {children}
    </motion.div>
  );
}