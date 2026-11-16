# Cantina AD Olinda

Pedidos antecipados da cantina da Assembleia de Deus Residencial Olinda.

As pessoas recebem um link, escolhem o que querem e informam nome e WhatsApp. Depois pagam pelo **Pix** (o QR code já vem com o valor exato, direto na chave da igreja e sem taxa) ou escolhem **pagar na retirada**. O pedido fica separado e contabilizado na hora, e o estoque de cada item baixa sozinho: quando acaba, aparece "Esgotado".

Tudo é controlado pelo **painel** (`/painel`):

| Tela | Para quê |
|---|---|
| **Pedidos de hoje** | Lista com busca por nome/número, botões "Recebi Pix", "Recebi dinheiro", "Entregar" e "Cancelar". Mostra também o total vendido, o que já entrou (Pix/dinheiro), o que falta receber e o quanto separar de cada item. |
| **Venda no balcão** | Caixa rápido para quem compra na hora, com cálculo do troco. Entra no mesmo controle. |
| **Vendas** | Cada domingo é uma venda: título, dia da retirada, horário limite dos pedidos e, para cada item, o preço do dia e quantas unidades foram produzidas. "Abrir para pedidos" publica no link. |
| **Cardápio** | Produtos, preços sugeridos, emoji e foto (enviada do celular). |
| **Configurações** | Logo, nome, frase, endereço, cultos, Instagram, chave Pix e WhatsApp que recebe os comprovantes. |
| **Equipe** | Acesso das voluntárias (administrador ou voluntário). |

O botão **Baixar planilha** gera um arquivo para o Excel com todos os pedidos da venda, para a prestação de contas.

## Publicar na internet (grátis)

> O GitHub Pages **não serve** para este sistema: ele só publica páginas fixas, e aqui existem banco de dados, pedidos e login.
> O caminho gratuito é a **Vercel**, ligada a este repositório do GitHub. Cada atualização no Git publica sozinha.

1. **Banco de dados (Neon, grátis):** em [neon.tech](https://neon.tech), crie um projeto (região São Paulo) e copie a *connection string* (`postgresql://...`).
2. **Criar as tabelas e os dados iniciais** (no computador, uma vez):
   - Crie o arquivo `.env.producao` com:
     ```
     DATABASE_URL=postgresql://...   (a do Neon)
     ADMIN_EMAIL=o-email-do-administrador
     ```
   - Rode `npm run db:producao`. O comando mostra a **senha provisória** do administrador. Guarde-a: ela é trocada no primeiro acesso.
3. **Vercel:** em [vercel.com](https://vercel.com), escolha *Add New → Project*, importe este repositório e, em *Environment Variables*, preencha:
   - `DATABASE_URL`: a mesma do Neon
   - `SESSION_SECRET`: um texto aleatório e longo, gerado com `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`
   - `SITE_URL`: o endereço final, ex.: `https://cantina-adolinda.vercel.app`
4. Clique em **Deploy**. Depois entre em `/painel`, abra **Configurações**, envie a logo e preencha a chave Pix.

## Desenvolvimento

```bash
npm install
npm run db:migrate   # banco local (PGlite), sem instalar nada
npm run db:seed      # dados da igreja, cardápio dos cartazes e administrador
npm run dev          # http://localhost:3030
```

Sem `DATABASE_URL`, o sistema usa um PostgreSQL embutido, gravado em `~/.cantina-igreja/pglite`.
Para os testes, use `npm test`; para a checagem de tipos, `npm run typecheck`.
