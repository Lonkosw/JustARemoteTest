import { ComingSoon } from "@/components/coming-soon";

export default function ProgressPage() {
  return (
    <ComingSoon
      title="Evolução"
      stage={4}
      items={[
        "Histórico de treinos",
        "Recordes (PR) e 1RM estimado",
        "Gráficos de carga por exercício",
        "Peso, medidas e fotos (etapa 5)",
      ]}
    />
  );
}
