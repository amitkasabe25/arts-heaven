import type { ReactNode } from "react";
import { motion } from "framer-motion";

export function PageHeader({
  eyebrow,
  title,
  intro,
  children,
}: {
  eyebrow?: string;
  title: ReactNode;
  intro?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="bg-dream border-b border-border">
      <div className="container-page py-14 md:py-20">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-2xl"
        >
          {eyebrow && <p className="eyebrow mb-4">{eyebrow}</p>}
          <h1 className="text-4xl leading-[1.05] text-plum md:text-6xl">{title}</h1>
          {intro && <p className="mt-5 text-base text-muted-foreground md:text-lg">{intro}</p>}
          {children}
        </motion.div>
      </div>
    </section>
  );
}
