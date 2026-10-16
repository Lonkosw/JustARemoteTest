import { Card, PageTitle } from "@/components/ui";

/** Placeholder for screens planned in later stages. */
export function ComingSoon({ title, stage, items }: { title: string; stage: number; items: string[] }) {
  return (
    <>
      <PageTitle>{title}</PageTitle>
      <Card>
        <p className="text-sm font-semibold text-accent">Chega na etapa {stage}</p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-muted">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </Card>
    </>
  );
}
