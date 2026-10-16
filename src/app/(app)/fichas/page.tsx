import { ComingSoon } from "@/components/coming-soon";

export default function RoutinesPage() {
  return (
    <ComingSoon
      title="Fichas"
      stage={2}
      items={[
        "Biblioteca com ~150 exercícios",
        "Montar ficha manualmente",
        "Modelos prontos: Full Body, ABC, ABCD, PPL, Upper/Lower",
      ]}
    />
  );
}
