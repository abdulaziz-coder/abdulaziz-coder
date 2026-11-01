import { useId, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

export default function Accordion({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const reduced = useReducedMotion();
  return <div className="faq-item">
    <button id={`${id}-question`} aria-expanded={open} aria-controls={`${id}-answer`} onClick={() => setOpen(!open)}>
      {question}<motion.span aria-hidden="true" animate={{ rotate: open ? 45 : 0 }} transition={{ duration: reduced ? 0 : .22 }}>+</motion.span>
    </button>
    <motion.div id={`${id}-answer`} role="region" aria-labelledby={`${id}-question`} initial={false}
      animate={{ height: open ? 'auto' : 0, opacity: open ? 1 : 0 }}
      transition={{ duration: reduced ? 0 : .3, ease: [.22, 1, .36, 1] }} inert={!open} className="accordion-body">
      <p>{answer}</p>
    </motion.div>
  </div>;
}
