import type { ReactNode } from "react";

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center rounded-3xl border border-dashed border-lilac bg-card px-8 py-14 text-center">
      <div className="mb-5 grid size-16 place-items-center rounded-full bg-secondary text-primary [&_svg]:size-7">
        {icon}
      </div>
      <h2 className="text-2xl text-plum">{title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{body}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
