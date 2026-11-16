/**
 * Logo da igreja, enviada em Configurações (servida em /logo; sem logo, um selo com as iniciais).
 * `versao` muda quando a logo é trocada, para o navegador buscar a nova.
 */
export function Logo({ nome, versao, tamanho = 48 }: { nome: string; versao?: number | null; tamanho?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- imagem pequena servida pelo próprio sistema
    <img
      src={`/logo?v=${versao ?? 0}`}
      alt={nome}
      width={tamanho}
      height={tamanho}
      style={{ width: tamanho, height: tamanho }}
      className="shrink-0 object-contain"
    />
  );
}
